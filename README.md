# DiaMon — Sistema de Monitoreo GPS y Telemetría Clínica (Caso de Estudio)

**Proyecto de Aula — Tecnología en Desarrollo de Software**

Plataforma web progresiva (PWA) y aplicación móvil para el monitoreo en tiempo real de geolocalización GPS, glucosa capilar, presión arterial y adherencia farmacológica en adultos mayores con **Diabetes Mellitus Tipo 2 e Hipertensión Arterial**.

## Caso de Estudio Aplicado

- **Paciente:** Damián Díaz Balseiro (`DM-8492`)
- **Ubicación de Geocerca:** Barrio Chapacuá, Cartagena de Indias (`Lat: 10.39991, Lng: -75.47886`)
- **Orientación Clínica:** Enf. Jefe Elizabeth Vargas Caro
- **Cuidadora Principal:** Valentina Díaz Martínez

## Estructura del Proyecto

- `/pages`: Vistas HTML del sistema (`index.html`, `login.html`, `zonas-seguras.html`, `registros_usuario.html`, `reportes.html`, `perfil.html`, `ficha-emergencia.html`, `descargar-app.html`, `admin.html`).
- `/assets/css` y `/assets/js`: Hojas de estilo y módulos de lógica clínica, mapas con Leaflet y sincronización con Supabase Realtime.
- `/api/diabot.js`: Endpoint Serverless para el asistente clínico DiaBot.
- `/database`: Esquema SQL de Supabase con políticas RLS para Paciente, Cuidador y Administrador.
- `/android-studio-app`: Proyecto nativo Android (Java + WebView con permisos `ACCESS_FINE_LOCATION`).
- `/src`: Arquitectura Hexagonal (`domain`, `application`, `infrastructure`) incluyendo el motor preventivo wearable sin parche (`DetectorGlucemicoPreventivoService`, `MonitorearBiometriaPreventivaUseCase` y `WebBluetoothWearableAdapter`).

## Monitoreo Preventivo Sin Parche (Wearable: Reloj / Anillo / Banda)

Módulo de alerta temprana que utiliza biomarcadores indirectos (**ritmo cardíaco en BPM** y **temperatura corporal en °C** cuando el dispositivo la incluye) como detectores preventivos de una posible bajada (hipoglucemia) o subida de azúcar (hiperglucemia), sin necesidad de parche continuo:

1. **Alarma en simultáneo (t = 0s):** Al detectar anomalía, suena y notifica al mismo tiempo a la persona con diabetes y al cuidador.
2. **Confirmación en 1 minuto (60s):** El paciente cuenta con una pantalla de alto contraste para confirmar **"Estoy bien"** y cancelar el escalamiento.
3. **Escalamiento automático (t = 60s sin respuesta):** Si el paciente no responde en 1 minuto (o solicita ayuda inmediata), el cuidador recibe automáticamente la **ubicación GPS exacta** y el **reporte completo de síntomas biométricos**.
4. **Preparado para reloj inteligente:** Incluye adaptador estándar **Web Bluetooth (BLE GATT `0x180D` Heart Rate + `0x1809` Health Thermometer)** y el puente global `window.DiaMonWearableBridge.inyectarLecturaExterna(...)` listo para integrar Wear OS, Health Connect, Samsung/Apple Watch o sensores BLE.

> **Nota clínica:** Este módulo es un sistema de apoyo preventivo basado en síntomas fisiológicos; no mide la glucosa directamente ni sustituye el glucómetro capilar ni el diagnóstico médico.

## Ejecución Local

```bash
node server.js
```

Abrir en el navegador: `http://localhost:8080`

## Pruebas

```bash
node --test tests/diamon.test.js
```

## Preparación para presentación

1. Ejecuta el esquema SQL de `database/supabase-schema.sql`, `database/02_caso_estudio_abuelo.sql` y `database/03_monitoreo_preventivo_wearable.sql` en tu proyecto Supabase.
2. Configura `GEMINI_API_KEY` únicamente como variable de entorno del servidor:

```powershell
$env:GEMINI_API_KEY="tu-clave"
node server.js
```

3. Crea el usuario administrador siguiendo `database/seed-admin.sql`.
4. Usa HTTPS para GPS real y concede permisos de ubicación en el navegador.
5. Presenta el sistema como prototipo académico de apoyo. No lo presentes como un dispositivo médico certificado ni como sustituto de diagnóstico profesional.
