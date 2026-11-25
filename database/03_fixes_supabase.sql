-- =====================================================
-- DiaMon - Migración 03: Correcciones Críticas Supabase
-- Sistema Integral de Monitoreo GPS & Telemetría Clínica
-- =====================================================

-- 0. Reparar tabla profiles, constraint de roles y trigger de registro automático (auth.users -> public.profiles)
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  nombre     text not null default 'Usuario',
  rol        text not null default 'usuario',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists nombre text not null default 'Usuario';
alter table public.profiles add column if not exists rol text not null default 'usuario';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check
  check (rol in ('usuario', 'admin', 'cuidador', 'monitoreado'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_rol text := 'usuario';
  rol_meta text;
begin
  rol_meta := new.raw_user_meta_data->>'rol';
  if rol_meta in ('cuidador', 'monitoreado', 'usuario', 'admin') then
    desired_rol := rol_meta;
  end if;

  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1), 'Usuario'),
    desired_rol
  )
  on conflict (id) do update
    set nombre = excluded.nombre,
        rol = excluded.rol,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rellenar perfiles faltantes para usuarios ya creados en auth.users
insert into public.profiles (id, nombre, rol)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'), ''), split_part(u.email, '@', 1), 'Usuario'),
       case when (u.raw_user_meta_data->>'rol') in ('cuidador', 'monitoreado', 'usuario', 'admin')
            then u.raw_user_meta_data->>'rol'
            else 'usuario' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 1. Permitir roles 'cuidador' y 'monitoreado' en admin_set_role
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
    raise exception 'No autorizado: Se requiere rol de administrador.';
  end if;

  if new_role not in ('usuario', 'admin', 'cuidador', 'monitoreado') then
    raise exception 'Rol inválido: %. Los roles válidos son: usuario, admin, cuidador, monitoreado.', new_role;
  end if;

  -- Proteger último admin para no perder acceso
  if new_role <> 'admin' then
    select count(*) into total_admins
    from public.profiles
    where rol = 'admin' and id <> target_user;

    if total_admins < 1 then
      raise exception 'No se puede cambiar el rol: debe existir al menos un administrador en el sistema.';
    end if;
  end if;

  update public.profiles
  set rol = new_role, updated_at = now()
  where id = target_user;
end;
$$;

grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 2. Asegurar default auth.uid() en tablas clínicas y operativas
alter table public.alertas alter column user_id set default auth.uid();
alter table public.registros alter column user_id set default auth.uid();
alter table public.presion_arterial alter column user_id set default auth.uid();
alter table public.metas_paciente alter column user_id set default auth.uid();
alter table public.tomas_medicamento alter column user_id set default auth.uid();

-- 3. Ampliar constraint de tipos de alerta para cubrir telemetría clínica
alter table public.alertas drop constraint if exists alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check 
  check (tipo in ('zona_segura', 'geocerca', 'gps_perdido', 'glucosa_alta', 'glucosa_baja', 'presion_alta', 'presion_baja', 'medicacion_pendiente', 'medicamento', 'medicamento_tomado', 'ubicacion', 'emergencia_manual', 'sistema', 'recordatorio'));

-- 4. Ampliar constraint de registros clínicos
alter table public.registros drop constraint if exists registros_tipo_check;
alter table public.registros add constraint registros_tipo_check 
  check (tipo in ('glucosa', 'presion', 'actividad', 'alimentacion', 'medicacion', 'nota', 'alerta'));

-- 5. Políticas RLS completas para alertas (paciente, cuidador, admin)
drop policy if exists "own alertas" on public.alertas;
create policy "own alertas" on public.alertas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador lee alertas" on public.alertas;
create policy "cuidador lee alertas" on public.alertas
  for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador inserta alertas" on public.alertas;
create policy "cuidador inserta alertas" on public.alertas
  for insert with check (public.es_cuidador_de(user_id) or auth.uid() = user_id);

drop policy if exists "cuidador actualiza alertas" on public.alertas;
create policy "cuidador actualiza alertas" on public.alertas
  for update using (public.es_cuidador_de(user_id));

drop policy if exists "admin gestiona alertas" on public.alertas;
create policy "admin gestiona alertas" on public.alertas
  for all using (public.is_admin());

-- 6. Políticas RLS para tomas_medicamento
drop policy if exists "own tomas" on public.tomas_medicamento;
create policy "own tomas" on public.tomas_medicamento
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador gestiona tomas" on public.tomas_medicamento;
create policy "cuidador gestiona tomas" on public.tomas_medicamento
  for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id));

-- 7. Políticas RLS para presion_arterial
drop policy if exists "own presion" on public.presion_arterial;
create policy "own presion" on public.presion_arterial
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador gestiona presion" on public.presion_arterial;
create policy "cuidador gestiona presion" on public.presion_arterial
  for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id));

-- 8. Políticas RLS para metas_paciente
drop policy if exists "own metas" on public.metas_paciente;
create policy "own metas" on public.metas_paciente
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador gestiona metas" on public.metas_paciente;
create policy "cuidador gestiona metas" on public.metas_paciente
  for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id));
