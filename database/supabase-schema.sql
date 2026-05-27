-- =====================================================
-- Esquema Supabase para la app DiaMon (GPS)
-- =====================================================
-- Cómo aplicarlo:
--   1. Entra al Dashboard de Supabase de tu proyecto
--   2. SQL Editor → New query
--   3. Pega TODO este archivo y ejecuta (Run)
--
-- Script idempotente: puedes correrlo varias veces sin romper nada.
-- =====================================================

-- -----------------------------------------------------
-- 1) Tabla PROFILES
-- Datos públicos del usuario, ligados 1:1 con auth.users.
-- La autenticación (email, password) la maneja auth.users (Supabase).
-- -----------------------------------------------------
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  nombre     text not null,
  rol        text not null default 'usuario',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Si la tabla ya existía sin la columna rol, la agregamos.
alter table public.profiles
  add column if not exists rol text not null default 'usuario';

-- Solo aceptamos roles conocidos.
alter table public.profiles
  drop constraint if exists profiles_rol_check;

alter table public.profiles
  add constraint profiles_rol_check check (rol in ('usuario', 'admin'));

-- -----------------------------------------------------
-- 2) Activar Row Level Security
-- -----------------------------------------------------
alter table public.profiles enable row level security;

-- -----------------------------------------------------
-- 3) Helper is_admin() — comprueba si el usuario actual es admin.
-- SECURITY DEFINER para que pueda leer su propio rol sin recursión RLS.
-- -----------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- -----------------------------------------------------
-- 4) Políticas RLS
--    - Todos pueden ver y editar SU propio perfil.
--    - Los admin pueden ver TODOS los perfiles (lectura).
--    - Los admin pueden actualizar el rol de cualquier usuario.
-- -----------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and rol = (select rol from public.profiles where id = auth.uid()));
-- nota: la cláusula with check evita que un usuario normal se auto-promueva a admin.

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------
-- 5) Trigger: crear automáticamente el perfil al registrarse.
-- El 'nombre' viene de raw_user_meta_data, que el cliente envía
-- en supabase.auth.signUp({ ..., options: { data: { nombre } } }).
--
-- Si el cliente envía además 'admin_code' y coincide con el código
-- secreto, el rol se asigna directamente como 'admin'. Si el código
-- no coincide (o no se envió), el rol queda como 'usuario'.
--
-- CAMBIA el código secreto antes de usar en producción. La
-- validación es del lado del servidor (security definer), por lo
-- que el cliente nunca ve ni puede falsificar este valor.
-- -----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_rol text := 'usuario';
  admin_code  text;
begin
  admin_code := new.raw_user_meta_data->>'admin_code';
  if admin_code is not null and admin_code = 'DIAMON-ADMIN-2026' then
    desired_rol := 'admin';
  end if;

  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'),
    desired_rol
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------
-- 6) Funciones admin — listar usuarios y cambiar rol
-- Estas funciones son SECURITY DEFINER para que un admin
-- pueda leer auth.users.email (que normalmente no es accesible
-- desde el cliente) y para que el cambio de rol pase por una
-- comprobación explícita de is_admin().
-- -----------------------------------------------------

-- Lista todos los usuarios — solo accesible por admins.
create or replace function public.admin_list_users()
returns table (
  id         uuid,
  nombre     text,
  email      text,
  rol        text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
    select p.id, p.nombre, u.email::text, p.rol, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- Cambia el rol de un usuario — solo accesible por admins.
-- Bloquea que un admin se auto-degrade si es el único admin existente.
create or replace function public.admin_set_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_admins int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if new_role not in ('usuario', 'admin') then
    raise exception 'Rol inválido: %', new_role;
  end if;

  -- Evita quedarse sin ningún admin en el sistema.
  if new_role = 'usuario' then
    select count(*) into total_admins from public.profiles where rol = 'admin';
    if total_admins <= 1 and (select rol from public.profiles where id = target_user) = 'admin' then
      raise exception 'No se puede degradar al único administrador';
    end if;
  end if;

  update public.profiles
  set rol = new_role, updated_at = now()
  where id = target_user;
end;
$$;

grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- KPIs agregados para el panel admin.
create or replace function public.admin_kpis()
returns table (
  total_usuarios int,
  total_admins   int,
  ultimos_7d     int,
  ultimos_30d    int
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
    select
      (select count(*)::int from public.profiles),
      (select count(*)::int from public.profiles where rol = 'admin'),
      (select count(*)::int from public.profiles where created_at >= now() - interval '7 days'),
      (select count(*)::int from public.profiles where created_at >= now() - interval '30 days');
end;
$$;

grant execute on function public.admin_kpis() to authenticated;

-- -----------------------------------------------------
-- 6.4) verificar_codigo_admin(code) — valida el código de admin
-- desde el cliente (usado por el login cuando seleccionas "Administrador").
-- Devuelve true/false. El código real solo vive aquí.
-- -----------------------------------------------------
create or replace function public.verificar_codigo_admin(code text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return code is not null and code = 'DIAMON-ADMIN-2026';
end;
$$;

grant execute on function public.verificar_codigo_admin(text) to anon, authenticated;

-- =====================================================
-- 7) TABLAS DE DATOS DEL PRODUCTO
-- glucosa_lecturas · gps_lecturas · rutas · registros · reportes
-- Cada tabla con RLS: el usuario ve/edita lo suyo, el admin lee todo.
-- =====================================================

-- -----------------------------------------------------
-- 7.1) GLUCOSA_LECTURAS
-- Cada toma de glucosa del usuario (manual o CGM).
-- -----------------------------------------------------
create table if not exists public.glucosa_lecturas (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  valor      int  not null check (valor >= 20 and valor <= 600),
  ts         timestamptz not null default now(),
  fuente     text default 'manual' check (fuente in ('manual', 'cgm', 'meter')),
  notas      text,
  created_at timestamptz default now()
);

create index if not exists idx_glucosa_user_ts on public.glucosa_lecturas(user_id, ts desc);

alter table public.glucosa_lecturas enable row level security;

drop policy if exists "own glucosa" on public.glucosa_lecturas;
create policy "own glucosa" on public.glucosa_lecturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads glucosa" on public.glucosa_lecturas;
create policy "admin reads glucosa" on public.glucosa_lecturas
  for select using (public.is_admin());

-- -----------------------------------------------------
-- 7.2) RUTAS
-- Trayectos completos con métricas agregadas.
-- -----------------------------------------------------
create table if not exists public.rutas (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  nombre            text,
  distancia_km      numeric(8,2),
  tiempo_min        int,
  glucosa_promedio  int,
  glucosa_max       int,
  glucosa_min       int,
  fecha             date not null default current_date,
  estado            text default 'completada' check (estado in ('completada', 'en_curso', 'cancelada')),
  created_at        timestamptz default now()
);

create index if not exists idx_rutas_user_fecha on public.rutas(user_id, fecha desc);

alter table public.rutas enable row level security;

drop policy if exists "own rutas" on public.rutas;
create policy "own rutas" on public.rutas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads rutas" on public.rutas;
create policy "admin reads rutas" on public.rutas
  for select using (public.is_admin());

-- -----------------------------------------------------
-- 7.3) GPS_LECTURAS
-- Puntos GPS individuales, opcionalmente asociados a una ruta.
-- -----------------------------------------------------
create table if not exists public.gps_lecturas (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ruta_id    bigint references public.rutas(id) on delete set null,
  lat        double precision not null,
  lng        double precision not null,
  velocidad  numeric(5,2),
  ts         timestamptz not null default now()
);

create index if not exists idx_gps_user_ts  on public.gps_lecturas(user_id, ts desc);
create index if not exists idx_gps_ruta     on public.gps_lecturas(ruta_id, ts);

alter table public.gps_lecturas enable row level security;

drop policy if exists "own gps" on public.gps_lecturas;
create policy "own gps" on public.gps_lecturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads gps" on public.gps_lecturas;
create policy "admin reads gps" on public.gps_lecturas
  for select using (public.is_admin());

-- -----------------------------------------------------
-- 7.4) REGISTROS
-- Registros generales del usuario (glucosa, actividad, alimentación, etc).
-- Para alimentar la vista registros_usuario.html.
-- -----------------------------------------------------
create table if not exists public.registros (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('glucosa', 'actividad', 'alimentacion', 'medicacion', 'nota')),
  valor      text,
  etiquetas  text[] default '{}',
  notas      text,
  ts         timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_registros_user_ts on public.registros(user_id, ts desc);
create index if not exists idx_registros_tipo    on public.registros(tipo);

alter table public.registros enable row level security;

drop policy if exists "own registros" on public.registros;
create policy "own registros" on public.registros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads registros" on public.registros;
create policy "admin reads registros" on public.registros
  for select using (public.is_admin());

-- -----------------------------------------------------
-- 7.5) REPORTES
-- Reportes guardados (snapshot de estadísticas en un momento dado).
-- -----------------------------------------------------
create table if not exists public.reportes (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  nombre       text,
  periodo      text,
  tipo         text default 'general' check (tipo in ('general', 'periodo', 'personalizado')),
  datos        jsonb not null default '{}'::jsonb,
  generado_en  timestamptz default now()
);

create index if not exists idx_reportes_user on public.reportes(user_id, generado_en desc);

alter table public.reportes enable row level security;

drop policy if exists "own reportes" on public.reportes;
create policy "own reportes" on public.reportes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads reportes" on public.reportes;
create policy "admin reads reportes" on public.reportes
  for select using (public.is_admin());

-- =====================================================
-- 8) TABLA ALERTAS
-- Alertas generadas por el sistema o manualmente.
-- =====================================================
create table if not exists public.alertas (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('zona_segura', 'gps_perdido', 'glucosa_alta', 'glucosa_baja', 'emergencia_manual')),
  descripcion text,
  estado      text not null default 'activa' check (estado in ('activa', 'resuelta', 'ignorada')),
  ts          timestamptz not null default now(),
  created_at  timestamptz default now()
);

create index if not exists idx_alertas_user_ts on public.alertas(user_id, ts desc);

alter table public.alertas enable row level security;

drop policy if exists "own alertas" on public.alertas;
create policy "own alertas" on public.alertas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads alertas" on public.alertas;
create policy "admin reads alertas" on public.alertas
  for select using (public.is_admin());

drop policy if exists "admin insert alertas" on public.alertas;
create policy "admin insert alertas" on public.alertas
  for insert with check (public.is_admin());

-- =====================================================
-- 9) TABLA ZONAS_SEGURAS
-- Zonas geográficas configuradas por el admin/cuidador.
-- =====================================================
create table if not exists public.zonas_seguras (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  nombre          text not null,
  tipo_zona       text default 'circular' check (tipo_zona in ('circular', 'poligono')),
  centro_lat      double precision not null,
  centro_lng      double precision not null,
  radio_metros    int not null default 500,
  nivel_riesgo    text default 'medio' check (nivel_riesgo in ('bajo', 'medio', 'alto')),
  activa          boolean default true,
  created_at      timestamptz default now()
);

alter table public.zonas_seguras enable row level security;

drop policy if exists "own zonas" on public.zonas_seguras;
create policy "own zonas" on public.zonas_seguras
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin reads zonas" on public.zonas_seguras;
create policy "admin reads zonas" on public.zonas_seguras
  for select using (public.is_admin());

-- =====================================================
-- 10) FUNCIÓN admin_delete_user
-- Elimina un usuario del sistema (perfil + auth).
-- Solo accesible por admins.
-- =====================================================
create or replace function public.admin_delete_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  -- Evita que el admin se elimine a sí mismo
  if target_user = auth.uid() then
    raise exception 'No puedes eliminarte a ti mismo';
  end if;

  -- Eliminar de auth.users desencadena el CASCADE en profiles y demás tablas
  delete from auth.users where id = target_user;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- =====================================================
-- 11) NUEVOS ROLES: cuidador y monitoreado
-- Ampliar el constraint de roles y actualizar funciones.
-- =====================================================

-- Ampliar roles permitidos
alter table public.profiles
  drop constraint if exists profiles_rol_check;

alter table public.profiles
  add constraint profiles_rol_check
  check (rol in ('usuario', 'admin', 'cuidador', 'monitoreado'));

-- Actualizar trigger para aceptar nuevos roles desde metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_rol text := 'usuario';
  admin_code  text;
  rol_meta    text;
begin
  admin_code := new.raw_user_meta_data->>'admin_code';
  rol_meta   := new.raw_user_meta_data->>'rol';

  if admin_code is not null and admin_code = 'DIAMON-ADMIN-2026' then
    desired_rol := 'admin';
  elsif rol_meta in ('cuidador', 'monitoreado') then
    desired_rol := rol_meta;
  end if;

  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'),
    desired_rol
  );
  return new;
end;
$$;

-- =====================================================
-- 12) TABLA VINCULACIONES
-- Relaciona un cuidador con una persona monitoreada.
-- =====================================================
create table if not exists public.vinculaciones (
  id              bigserial primary key,
  cuidador_id     uuid not null references auth.users(id) on delete cascade,
  monitoreado_id  uuid not null references auth.users(id) on delete cascade,
  estado          text default 'activa' check (estado in ('activa', 'inactiva')),
  created_at      timestamptz default now(),
  unique(cuidador_id, monitoreado_id)
);

alter table public.vinculaciones enable row level security;

drop policy if exists "own vinculaciones" on public.vinculaciones;
create policy "own vinculaciones" on public.vinculaciones
  for all using (auth.uid() = cuidador_id or auth.uid() = monitoreado_id);

drop policy if exists "admin reads vinculaciones" on public.vinculaciones;
create policy "admin reads vinculaciones" on public.vinculaciones
  for select using (public.is_admin());

drop policy if exists "admin insert vinculaciones" on public.vinculaciones;
create policy "admin insert vinculaciones" on public.vinculaciones
  for insert with check (public.is_admin());

drop policy if exists "admin update vinculaciones" on public.vinculaciones;
create policy "admin update vinculaciones" on public.vinculaciones
  for update using (public.is_admin());

-- =====================================================
-- 13) FUNCIÓN admin_list_users actualizada
-- Incluye el nuevo campo de rol cuidador/monitoreado.
-- =====================================================
create or replace function public.admin_list_users()
returns table (
  id         uuid,
  nombre     text,
  email      text,
  rol        text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
    select p.id, p.nombre, u.email::text, p.rol, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- =====================================================
-- 14) FUNCIÓN admin_vincular
-- Crea o activa una vinculación cuidador <-> monitoreado.
-- =====================================================
create or replace function public.admin_vincular(p_cuidador uuid, p_monitoreado uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  insert into public.vinculaciones (cuidador_id, monitoreado_id, estado)
  values (p_cuidador, p_monitoreado, 'activa')
  on conflict (cuidador_id, monitoreado_id)
  do update set estado = 'activa';
end;
$$;

grant execute on function public.admin_vincular(uuid, uuid) to authenticated;

-- =====================================================
-- 15) FUNCIÓN admin_desvincular
-- =====================================================
create or replace function public.admin_desvincular(p_cuidador uuid, p_monitoreado uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.vinculaciones
  set estado = 'inactiva'
  where cuidador_id = p_cuidador and monitoreado_id = p_monitoreado;
end;
$$;

grant execute on function public.admin_desvincular(uuid, uuid) to authenticated;

-- =====================================================
-- 16) FUNCIÓN buscar_monitoreado_por_email
-- Permite al cuidador buscar una persona monitoreada
-- por su correo electrónico para vincularse.
-- =====================================================
create or replace function public.buscar_monitoreado_por_email(p_email text)
returns table (
  id     uuid,
  nombre text,
  rol    text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query
    select p.id, p.nombre, p.rol
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(p_email)
      and p.rol = 'monitoreado';
end;
$$;

grant execute on function public.buscar_monitoreado_por_email(text) to authenticated;
