-- =====================================================
-- DiaMon - Migración 02: Caso de Estudio Damián Díaz Balseiro
-- Diabetes Mellitus Tipo 2 + Hipertensión Arterial (Chapacuá)
-- =====================================================

create or replace function public.es_cuidador_de(p_paciente uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.vinculaciones
    where cuidador_id = auth.uid()
      and monitoreado_id = p_paciente
      and estado = 'activa'
  );
$$;

grant execute on function public.es_cuidador_de(uuid) to authenticated;

drop function if exists public.verificar_codigo_admin(text);

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
  if rol_meta in ('cuidador', 'monitoreado', 'usuario') then
    desired_rol := rol_meta;
  end if;

  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'),
    desired_rol
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "cuidador lee glucosa" on public.glucosa_lecturas;
create policy "cuidador lee glucosa" on public.glucosa_lecturas for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador registra glucosa" on public.glucosa_lecturas;
create policy "cuidador registra glucosa" on public.glucosa_lecturas for insert with check (public.es_cuidador_de(user_id));

drop policy if exists "cuidador lee rutas" on public.rutas;
create policy "cuidador lee rutas" on public.rutas for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador lee gps" on public.gps_lecturas;
create policy "cuidador lee gps" on public.gps_lecturas for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador lee registros" on public.registros;
create policy "cuidador lee registros" on public.registros for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador lee alertas" on public.alertas;
create policy "cuidador lee alertas" on public.alertas for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador actualiza alertas" on public.alertas;
create policy "cuidador actualiza alertas" on public.alertas for update using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador gestiona zonas" on public.zonas_seguras;
create policy "cuidador gestiona zonas" on public.zonas_seguras for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id));

alter table public.glucosa_lecturas add column if not exists contexto text default 'ayunas';

create table if not exists public.presion_arterial (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sistolica int not null check (sistolica >= 50 and sistolica <= 260),
  diastolica int not null check (diastolica >= 30 and diastolica <= 160),
  pulso_bpm int check (pulso_bpm >= 30 and pulso_bpm <= 220),
  brazo text default 'izquierdo',
  postura text default 'sentado',
  sintomas text,
  ts timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_presion_user_ts on public.presion_arterial(user_id, ts desc);
alter table public.presion_arterial enable row level security;

drop policy if exists "own presion" on public.presion_arterial;
create policy "own presion" on public.presion_arterial for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador lee presion" on public.presion_arterial;
create policy "cuidador lee presion" on public.presion_arterial for select using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador registra presion" on public.presion_arterial;
create policy "cuidador registra presion" on public.presion_arterial for insert with check (public.es_cuidador_de(user_id));

create table if not exists public.metas_paciente (
  user_id uuid primary key references auth.users(id) on delete cascade,
  glucosa_min int not null default 80,
  glucosa_meta_ayunas int not null default 135,
  glucosa_max_post int not null default 180,
  sistolica_min int not null default 95,
  sistolica_max int not null default 140,
  diastolica_min int not null default 60,
  diastolica_max int not null default 90,
  profesional_nombre text default 'Enf. Jefe Elizabeth Vargas Caro',
  profesional_registro text default 'Caso de Estudio Barrio Chapacua',
  notas_clinicas text,
  updated_at timestamptz default now()
);

alter table public.metas_paciente enable row level security;

drop policy if exists "own metas" on public.metas_paciente;
create policy "own metas" on public.metas_paciente for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador gestiona metas" on public.metas_paciente;
create policy "cuidador gestiona metas" on public.metas_paciente for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id));

create table if not exists public.tomas_medicamento (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  medicamento_id text not null,
  medicamento_nombre text not null,
  dosis text not null,
  horario_programado text not null,
  fecha date not null default current_date,
  tomada boolean not null default true,
  confirmado_por text default 'paciente',
  ts timestamptz not null default now(),
  unique(user_id, medicamento_id, fecha)
);

alter table public.tomas_medicamento enable row level security;

drop policy if exists "own tomas" on public.tomas_medicamento;
create policy "own tomas" on public.tomas_medicamento for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cuidador lee y confirma tomas" on public.tomas_medicamento;
create policy "cuidador lee y confirma tomas" on public.tomas_medicamento for all using (public.es_cuidador_de(user_id)) with check (public.es_cuidador_de(user_id));

alter table public.alertas drop constraint if exists alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check check (tipo in ('zona_segura', 'geocerca', 'gps_perdido', 'glucosa_alta', 'glucosa_baja', 'presion_alta', 'presion_baja', 'medicacion_pendiente', 'medicamento', 'medicamento_tomado', 'ubicacion', 'emergencia_manual', 'sistema'));

alter table public.registros drop constraint if exists registros_tipo_check;
alter table public.registros add constraint registros_tipo_check check (tipo in ('glucosa', 'presion', 'actividad', 'alimentacion', 'medicacion', 'nota'));

