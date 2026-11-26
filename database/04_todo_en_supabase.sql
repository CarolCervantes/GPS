-- =====================================================================
-- DiaMon - 04: guardar todo en Supabase (web y app ven los mismos datos)
-- Se puede correr varias veces sin problema. No borra datos.
-- Correr en: Supabase -> SQL Editor -> New query -> pegar -> Run
-- =====================================================================

-- 1) Datos del paciente dentro de su perfil --------------------------------
alter table public.profiles add column if not exists codigo_paciente text unique;
alter table public.profiles add column if not exists diagnostico text;
alter table public.profiles add column if not exists barrio text;
alter table public.profiles add column if not exists profesional_guia text;
alter table public.profiles add column if not exists ficha jsonb not null default '{}'::jsonb;

-- 2) Las alertas guardan titulo y datos extra (ubicacion, color, etc.) -----
alter table public.alertas add column if not exists titulo text;
alter table public.alertas add column if not exists datos jsonb not null default '{}'::jsonb;

-- 3) Codigo unico DM-XXXX para cada paciente --------------------------------
create or replace function public.generar_codigo_paciente()
returns text language plpgsql as $$
declare
  nuevo text;
begin
  loop
    nuevo := 'DM-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.profiles where codigo_paciente = nuevo);
  end loop;
  return nuevo;
end;
$$;

-- 4) Al registrarse se crea el perfil. El rol admin NUNCA se toma del registro
--    (antes cualquiera podia ponerse admin mandando rol=admin).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rol_meta text := coalesce(new.raw_user_meta_data->>'rol', 'monitoreado');
  rol_final text;
begin
  rol_final := case when rol_meta = 'cuidador' then 'cuidador' else 'monitoreado' end;

  insert into public.profiles (id, nombre, rol, codigo_paciente)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)),
    rol_final,
    case when rol_final = 'monitoreado' then public.generar_codigo_paciente() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que se registraron pero quedaron sin perfil
insert into public.profiles (id, nombre, rol)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'), ''), split_part(u.email, '@', 1)),
       case when u.raw_user_meta_data->>'rol' = 'cuidador' then 'cuidador' else 'monitoreado' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Pacientes que ya existian sin codigo
update public.profiles set codigo_paciente = public.generar_codigo_paciente()
where rol in ('monitoreado', 'usuario') and codigo_paciente is null;

-- 5) Nadie cambia su propio rol (ni el de su paciente); solo un admin -------
create or replace function public.proteger_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() es null cuando se corre desde el SQL Editor (lo hace el dueño del proyecto)
  if new.rol is distinct from old.rol and auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_rol_profiles on public.profiles;
create trigger proteger_rol_profiles
  before update on public.profiles
  for each row execute function public.proteger_rol();

-- 6) Vincular un paciente con su codigo (lo usan cuidador y admin) ----------
create or replace function public.vincular_con_codigo(p_codigo text)
returns table (id uuid, nombre text, codigo_paciente text)
language plpgsql security definer set search_path = public as $$
declare
  pac record;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion';
  end if;

  select p.id, p.nombre, p.codigo_paciente into pac
  from public.profiles p
  where upper(p.codigo_paciente) = upper(trim(p_codigo)) and p.rol in ('monitoreado', 'usuario');

  if pac.id is null then
    raise exception 'No existe ningun paciente con el codigo %', p_codigo;
  end if;

  insert into public.vinculaciones (cuidador_id, monitoreado_id, estado)
  values (auth.uid(), pac.id, 'activa')
  on conflict (cuidador_id, monitoreado_id) do update set estado = 'activa';

  return query select pac.id, pac.nombre, pac.codigo_paciente;
end;
$$;
grant execute on function public.vincular_con_codigo(text) to authenticated;

-- 7) Lista de pacientes que supervisa el usuario actual ---------------------
create or replace function public.mis_pacientes()
returns table (id uuid, nombre text, codigo_paciente text)
language sql security definer stable set search_path = public as $$
  select p.id, p.nombre, p.codigo_paciente
  from public.vinculaciones v
  join public.profiles p on p.id = v.monitoreado_id
  where v.cuidador_id = auth.uid() and v.estado = 'activa'
  order by v.created_at;
$$;
grant execute on function public.mis_pacientes() to authenticated;

-- 8) Permisos (RLS): el paciente maneja lo suyo, su cuidador tambien,
--    y el admin puede leer todo.
create or replace function public.es_cuidador_de(p_paciente uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculaciones
    where cuidador_id = auth.uid() and monitoreado_id = p_paciente and estado = 'activa'
  );
$$;
grant execute on function public.es_cuidador_de(uuid) to authenticated;

-- Perfil del paciente
drop policy if exists "cuidador lee perfil de su paciente" on public.profiles;
create policy "cuidador lee perfil de su paciente" on public.profiles
  for select using (public.es_cuidador_de(id));
drop policy if exists "cuidador actualiza perfil de su paciente" on public.profiles;
create policy "cuidador actualiza perfil de su paciente" on public.profiles
  for update using (public.es_cuidador_de(id)) with check (public.es_cuidador_de(id));

-- Tablas de datos clinicos: mismas reglas para todas
do $$
declare
  t text;
begin
  foreach t in array array['glucosa_lecturas', 'presion_arterial', 'tomas_medicamento', 'alertas',
                           'zonas_seguras', 'registros', 'gps_lecturas', 'metas_paciente']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "diamon propio" on public.%I', t);
    execute format('create policy "diamon propio" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "diamon cuidador" on public.%I', t);
    execute format('create policy "diamon cuidador" on public.%I for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id))', t);

    execute format('drop policy if exists "diamon admin lee" on public.%I', t);
    execute format('create policy "diamon admin lee" on public.%I for select using (public.is_admin())', t);
  end loop;
end $$;

-- 9) Tiempo real: avisar a la web y a la app cuando cambie algo -------------
do $$
declare
  t text;
begin
  foreach t in array array['glucosa_lecturas', 'presion_arterial', 'tomas_medicamento', 'alertas',
                           'zonas_seguras', 'registros', 'gps_lecturas', 'metas_paciente', 'profiles', 'vinculaciones']
  loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 10) La cuenta de Valentina es de cuidadora (no es paciente) --------------
update public.profiles
set rol = 'cuidador', codigo_paciente = null, nombre = 'Valentina Díaz Martínez'
where id = (select id from auth.users where lower(email) = 'valentinadiaz2202@gmail.com');

-- 11) Revisar que quedo bien ------------------------------------------------
select
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public') as tablas_en_tiempo_real,
  (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) as usuarios_sin_perfil,
  (select rol from public.profiles where id = (select id from auth.users where lower(email) = 'valentinadiaz2202@gmail.com')) as rol_valentina,
  (select count(*) from pg_proc where proname in ('vincular_con_codigo', 'mis_pacientes', 'proteger_rol', 'generar_codigo_paciente')) as funciones_nuevas;

-- 12) Ficha de emergencia publica por QR (solo datos de emergencia, con una clave imposible de adivinar)
alter table public.profiles add column if not exists ficha_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_ficha_token_idx on public.profiles (ficha_token);

create or replace function public.ficha_publica(p_token uuid)
returns table (nombre text, diagnostico text, ficha jsonb, profesional_guia text)
language sql security definer stable set search_path = public as $$
  select p.nombre, p.diagnostico, p.ficha - 'inventario', p.profesional_guia
  from public.profiles p
  where p.ficha_token = p_token and p.rol in ('monitoreado', 'usuario');
$$;
grant execute on function public.ficha_publica(uuid) to anon, authenticated;
