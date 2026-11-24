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

## Ejecución Local

```bash
node server.js
```

Abrir en el navegador: `http://localhost:8080`
