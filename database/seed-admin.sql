-- =====================================================
-- DiaMon — Crear el usuario administrador
-- =====================================================
--
-- IMPORTANTE: No commitees credenciales reales en este archivo.
-- Reemplaza los placeholders al ejecutar y no guardes la contraseña aquí.
--
-- PASOS:
-- -----------------------------------------------------
-- (1) Asegúrate de haber ejecutado primero `supabase-schema.sql`
--     para que la tabla profiles tenga la columna `rol`.
--
-- (2) Crea el usuario admin en Supabase:
--
--     Opción A — Recomendada (Dashboard):
--       Authentication → Users → "Add user" → "Create new user"
--       - Email:    el correo que quieras usar como admin
--       - Password: una contraseña FUERTE (mínimo 12 caracteres,
--                   con mayúsculas, minúsculas, números y símbolos)
--       - Marcar "Auto Confirm User" para no necesitar verificación
--
--     Opción B — Desde la app:
--       Regístrate normalmente en https://tu-app/login.html
--       y confirma el correo. Luego sigue al paso (3).
--
-- (3) Promueve a ese usuario a rol 'admin' con la siguiente query.
--     Reemplaza 'TU_CORREO_AQUI@ejemplo.com' por el email real.
-- -----------------------------------------------------

update public.profiles
set rol = 'admin', updated_at = now()
where id = (
  select id from auth.users where email = 'TU_CORREO_AQUI@ejemplo.com'
);

-- -----------------------------------------------------
-- (4) Verifica que el rol quedó asignado:
-- -----------------------------------------------------

select u.email, p.nombre, p.rol, p.updated_at
from public.profiles p
join auth.users u on u.id = p.id
where p.rol = 'admin';

-- -----------------------------------------------------
-- Para REVOCAR admin (degradar a usuario normal):
-- -----------------------------------------------------
-- update public.profiles
-- set rol = 'usuario', updated_at = now()
-- where id = (
--   select id from auth.users where email = 'CORREO_A_DEGRADAR@ejemplo.com'
-- );
