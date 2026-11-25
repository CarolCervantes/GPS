-- =====================================================
-- DiaMon - Migración 03: Monitoreo Preventivo Sin Parche (Wearable)
-- Detección indirecta por Ritmo Cardíaco + Temperatura Corporal
-- Alarma simultánea (paciente + cuidador) y escalamiento a 60s con GPS y síntomas
-- Script idempotente (puede ejecutarse varias veces sin romper datos).
-- =====================================================

-- 1) Tabla de lecturas biométricas provenientes de reloj inteligente, anillo o banda BLE
create table if not exists public.biometria_wearable (
  id                  bigserial primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  dispositivo_tipo    text not null default 'reloj_inteligente'
                      check (dispositivo_tipo in ('reloj_inteligente', 'anillo_inteligente', 'banda_fitness', 'sensor_ble', 'simulador')),
  dispositivo_nombre  text not null default 'Wearable DiaMon',
  fuente              text not null default 'ble_real'
                      check (fuente in ('ble_real', 'bridge_nativo', 'manual', 'simulador')),
  ritmo_cardiaco_bpm  int not null check (ritmo_cardiaco_bpm >= 25 and ritmo_cardiaco_bpm <= 240),
  temperatura_c       numeric(4,1) check (temperatura_c is null or (temperatura_c >= 31.0 and temperatura_c <= 43.0)),
  delta_bpm           int,
  delta_temp          numeric(4,2),
  riesgo_detectado    text not null default 'estable'
                      check (riesgo_detectado in ('estable', 'vigilancia', 'posible_hipoglucemia', 'posible_hiperglucemia', 'anomalia_biometrica_critica')),
  sintomas_detectados text[] not null default '{}',
  bateria_dispositivo int check (bateria_dispositivo is null or (bateria_dispositivo >= 0 and bateria_dispositivo <= 100)),
  lat                 double precision,
  lng                 double precision,
  ts                  timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists idx_biometria_wearable_user_ts
  on public.biometria_wearable(user_id, ts desc);

alter table public.biometria_wearable enable row level security;

drop policy if exists "own biometria wearable" on public.biometria_wearable;
create policy "own biometria wearable"
  on public.biometria_wearable for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cuidador lee biometria wearable" on public.biometria_wearable;
create policy "cuidador lee biometria wearable"
  on public.biometria_wearable for select
  using (public.es_cuidador_de(user_id));

drop policy if exists "admin lee biometria wearable" on public.biometria_wearable;
create policy "admin lee biometria wearable"
  on public.biometria_wearable for select
  using (public.is_admin());

-- 2) Tabla de alertas preventivas simultáneas y escalamiento de 60 segundos al cuidador
create table if not exists public.alertas_preventivas_biometricas (
  id                  bigserial primary key,
  incidente_ref       text unique not null,
  user_id             uuid not null references auth.users(id) on delete cascade,
  estado              text not null default 'activa_esperando_respuesta'
                      check (estado in ('activa_esperando_respuesta', 'confirmado_bien', 'escalada_sin_respuesta', 'atendida')),
  riesgo_glucemico    text not null
                      check (riesgo_glucemico in ('posible_hipoglucemia', 'posible_hiperglucemia', 'anomalia_biometrica_critica')),
  ritmo_cardiaco_bpm  int not null check (ritmo_cardiaco_bpm >= 25 and ritmo_cardiaco_bpm <= 240),
  temperatura_c       numeric(4,1),
  sintomas_detectados text[] not null default '{}',
  tiempo_limite_seg   int not null default 60 check (tiempo_limite_seg >= 15 and tiempo_limite_seg <= 180),
  dispositivo_nombre  text not null default 'Wearable DiaMon',
  respondido_en       timestamptz,
  escalado_en         timestamptz,
  ubicacion_lat       double precision,
  ubicacion_lng       double precision,
  ubicacion_texto     text,
  ts                  timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists idx_alertas_prev_user_ts
  on public.alertas_preventivas_biometricas(user_id, ts desc);

alter table public.alertas_preventivas_biometricas enable row level security;

drop policy if exists "own alertas preventivas" on public.alertas_preventivas_biometricas;
create policy "own alertas preventivas"
  on public.alertas_preventivas_biometricas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cuidador lee alertas preventivas" on public.alertas_preventivas_biometricas;
create policy "cuidador lee alertas preventivas"
  on public.alertas_preventivas_biometricas for select
  using (public.es_cuidador_de(user_id));

drop policy if exists "cuidador actualiza alertas preventivas" on public.alertas_preventivas_biometricas;
create policy "cuidador actualiza alertas preventivas"
  on public.alertas_preventivas_biometricas for update
  using (public.es_cuidador_de(user_id));

drop policy if exists "admin lee alertas preventivas" on public.alertas_preventivas_biometricas;
create policy "admin lee alertas preventivas"
  on public.alertas_preventivas_biometricas for select
  using (public.is_admin());

-- 3) Ampliar constraints de tablas existentes para registrar eventos preventivos del wearable
alter table public.alertas drop constraint if exists alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check check (
  tipo in (
    'zona_segura', 'geocerca', 'gps_perdido',
    'glucosa_alta', 'glucosa_baja',
    'presion_alta', 'presion_baja',
    'medicacion_pendiente', 'medicamento', 'medicamento_tomado',
    'ubicacion', 'emergencia_manual', 'sistema',
    'preventiva_hipoglucemia', 'preventiva_hiperglucemia',
    'preventiva_biometrica', 'escalamiento_cuidador'
  )
);

alter table public.registros drop constraint if exists registros_tipo_check;
alter table public.registros add constraint registros_tipo_check check (
  tipo in ('glucosa', 'presion', 'actividad', 'alimentacion', 'medicacion', 'nota', 'biometria_wearable')
);
