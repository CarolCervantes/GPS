# DiaMon — Informe de cambios y funcionalidades (26 de noviembre de 2026)

Caso de estudio: **Damián Díaz Balseiro** (DM-8492, Barrio Chapacuá, Cartagena), diabetes tipo 2 con insulina e hipertensión, con la pauta de la **Enf. Jefe Elizabeth Vargas Caro**. Otros pacientes y cuidadores también se pueden registrar y cada uno tiene sus propios datos.

## 1. Qué cambió

### Cuentas, sesión y roles
- Registro e inicio de sesión **solo con Supabase** (se eliminaron las cuentas guardadas en el navegador y el login con Google/Apple/Facebook/Microsoft, que creaba cuentas falsas).
- Al crear cuenta hay que **confirmar el correo**; luego se inicia sesión. Opción para **reenviar el correo de confirmación** y **recuperar la contraseña** (pantalla para escribir la nueva).
- Roles: **paciente**, **cuidador** y **admin**. El admin no se puede pedir al registrarse (antes cualquiera podía ponerse admin); lo asigna otro admin o el dueño del proyecto.
- Cada paciente recibe un **código DM-XXXX** generado por la base de datos. El cuidador se vincula escribiendo ese código.
- Al cerrar sesión se borra todo rastro de la sesión (antes quedaba la vista de Damián).
- El invitado no ve datos ni ubicación de ningún paciente.

### Todo en la base de datos (Supabase) y en tiempo real
- Glucosa, presión, metas de la enfermera, zonas seguras, alertas, medicamentos tomados, estado del día, ficha médica, vencimiento de medicamentos, ubicación GPS, batería y pasos se guardan en Supabase.
- Lo que se registra en la web aparece solo en la app y al revés (Supabase Realtime), sin recargar.
- Se corrigió que lo registrado por el cuidador quedaba guardado con el id del cuidador y no con el del paciente.
- Script de base de datos: `database/04_todo_en_supabase.sql` (columnas nuevas, funciones, reglas de seguridad RLS y tiempo real).

### Datos inventados que se quitaron
- Historial falso de lecturas con horas que no cuadraban con el reloj, notificaciones fijas, batería en 87 %, usuarios de demostración, ubicación que se movía al hacer clic en el mapa, reporte semanal con medicamentos que no eran de Damián, SafeWalk.

### App Android
- Muestra la misma web (se copia con `npm run android:sync`).
- **Ubicación en segundo plano**: servicio nativo que envía la posición cada 30 s aunque la pantalla esté apagada (notificación fija "DiaMon está compartiendo tu ubicación").
- Diseño móvil: una columna, inicio simplificado, menú inferior visible sobre los botones de Android 15, DiaBot que no tapa el menú, ícono propio.
- CRUD nativo SQLite (guardar, buscar, modificar, eliminar) con aviso real de si sincronizó con Supabase.

### Seguridad
- Código de admin validado en el servidor (`api/validar-admin.js`), ya no visible en el navegador.
- Contraseñas locales viejas pasaron de `btoa` a SHA-256 (ahora las maneja Supabase).
- Reglas RLS: el paciente maneja lo suyo, su cuidador también, el admin puede leer todo.

### Otros
- Comentarios del código simplificados; Nifedipino y metas de glucosa unificados en todo el proyecto.
- DiaBot funciona con **Claude (Anthropic)** o **Gemini** si hay clave; si no, responde con su motor local.
- Unión con el commit de Leonel del QR: se conservó la versión que lee de Supabase y su SQL de ficha pública.

## 2. Funcionalidades que quedaron

| Funcionalidad | Paciente | Cuidador | Admin |
|---|---|---|---|
| Panel con glucosa, presión, GPS y batería en vivo | ✔ | ✔ (de su paciente) | ✔ (si vincula) |
| Registrar glucosa y presión (alerta si sale de la meta) | ✔ | ✔ | — |
| Metas de la enfermera | ver | editar | — |
| Transmitir GPS (también en segundo plano en la app) | ✔ | — | — |
| Zona segura y alerta al salir | — | ✔ | ✔ |
| Mapa en vivo y hospitales ordenados por cercanía | ✔ | ✔ | ✔ |
| Historial de recorridos GPS | ✔ | ✔ | ✔ |
| Medicamentos del día (marcar tomados) | ✔ | ✔ | — |
| ¿Cómo te sientes hoy? | registra | ve lo registrado | — |
| Guía educativa diaria (3 consejos) | ✔ | ✔ | ✔ |
| Control de vencimiento de medicamentos (editable) | ✔ | ✔ | — |
| Botón SOS con alerta y ubicación al cuidador | ✔ | recibe | — |
| Notificaciones en tiempo real con sonido | ✔ | ✔ | ✔ |
| Reporte del día con descarga en PDF | ✔ | ✔ | ✔ |
| Ficha médica QR (enlace seguro a la ficha de emergencia) | ✔ | ✔ | — |
| Vista simplificada para adulto mayor | ✔ | — | — |
| Vincular pacientes con su código DM | — | ✔ | ✔ |
| Panel de administración (usuarios, roles, vinculaciones) | — | — | ✔ |
| DiaBot (asistente) | ✔ | ✔ | ✔ |

## 3. Cuentas de la demostración
- Paciente: Damián Díaz Balseiro — código DM-8492.
- Cuidadora: Valentina Díaz Martínez (vinculada a DM-8492).
- Admin: una cuenta con rol de administrador.
- Los correos y contraseñas se manejan por fuera del repositorio.

## 4. Pendiente / a tener en cuenta
- Para que el QR abra la ficha desde cualquier celular, la web debe estar publicada (Vercel).
- DiaBot con IA necesita `ANTHROPIC_API_KEY` o `GEMINI_API_KEY` en Vercel (Settings → Environment Variables) o en un archivo `.env` local.
- El plan gratuito de Supabase envía pocos correos por hora (confirmación y recuperación).
- El celular del paciente debe tener la **Ubicación del sistema encendida** y el permiso "Permitir todo el tiempo".
