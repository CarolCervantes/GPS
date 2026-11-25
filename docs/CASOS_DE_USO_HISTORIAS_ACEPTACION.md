# DiaMon — De Casos de Uso a Gestión de Usuarios, Historias de Aceptación y Aplicación

> **Proyecto de Aula:** Tecnología en Desarrollo de Software  
> **Docente:** Prof. John Carlos Arrieta  
> **Caso de Estudio Principal:** Monitoreo clínico y satelital de **Damián Díaz Balseiro** (`DM-8492`, Barrio Chapacuá, Cartagena de Indias) + Registro abierto para pruebas de **Paciente**, **Cuidador / Familiar** y **Administrador**.

---

## 1. De Casos de Uso a Gestión de Usuarios (Historias de Usuario)

A continuación se muestra cómo cada **Caso de Uso (CU)** del sistema se transforma en una **Historia de Usuario (HU)** dentro de la gestión de usuarios por roles (**Paciente / Monitoreado**, **Cuidador / Familiar** y **Administrador**):

| Código CU | Caso de Uso | Rol / Actor | Código HU | Historia de Usuario (Como... Quiero... Para...) |
| :--- | :--- | :--- | :--- | :--- |
| **CU-01** | Registro y Autenticación por Rol con Código de Vinculación | Paciente, Cuidador, Admin | **HU-01** | **Como** usuario (Paciente, Cuidador o Admin), **quiero** registrarme e iniciar sesión con mi rol y código único (`DM-XXXX` o `DIAMON-ADMIN-2026`), **para** acceder a una interfaz adaptada a mis funciones y vincular al paciente con su familiar. |
| **CU-02** | Registro y Evaluación de Glucosa Capilar | Paciente / Cuidador | **HU-02** | **Como** paciente monitoreado o cuidador, **quiero** registrar mis lecturas de glucosa capilar indicando el momento de la toma (ayunas, postprandial, nocturna), **para** que el sistema evalúe si estoy en meta clínica (80–180 mg/dL) o dispare alerta de hipoglucemia/hiperglucemia. |
| **CU-03** | Registro y Evaluación de Presión Arterial (HTA) | Paciente / Cuidador | **HU-03** | **Como** paciente con hipertensión o cuidador, **quiero** registrar mi presión sistólica, diastólica y pulso, **para** verificar el control con Valsartán y Nifedipina (< 140/90 mmHg) y detectar crisis hipertensivas a tiempo. |
| **CU-04** | Monitoreo GPS Satelital y Geocercas (Zonas Seguras) | Paciente (Emisor) / Cuidador (Supervisor) | **HU-04** | **Como** cuidador familiar, **quiero** visualizar la ubicación GPS en tiempo real del paciente y definir un radio seguro (400m en Barrio Chapacuá), **para** recibir una alerta inmediata si el paciente sale del perímetro permitido. |
| **CU-05** | Control de Adherencia Farmacológica e Insulina | Paciente / Cuidador | **HU-05** | **Como** paciente monitoreado, **quiero** consultar mis horarios de medicamentos (8:00 AM, 2:00 PM, 8:00 PM, Insulina 24 UI a las 9:00 PM y Ozempic los sábados) y confirmar cada toma, **para** notificar a mi familia y evitar dosis omitidas. |
| **CU-06** | Activación de Alerta SOS y Ficha Médica QR | Paciente | **HU-06** | **Como** paciente en situación de mareo o emergencia, **quiero** activar un botón SOS de alto contraste o mostrar mi código QR médico (*PulseCard*), **para** enviar mis coordenadas GPS a mi cuidador y mostrar mi tratamiento a paramédicos. |
| **CU-07** | Vista Simplificada del Paciente (*Vista Simple*) | Paciente / Adulto Mayor | **HU-07** | **Como** paciente monitoreado o adulto mayor, **quiero** contar con una vista simplificada con botones grandes y lectura clara de mi glucosa, presión y pastillas, **para** usar la aplicación sin complejidad técnica. |
| **CU-08** | Gestión Administrativa de Usuarios, Roles y Vinculaciones | Administrador | **HU-08** | **Como** administrador del sistema, **quiero** gestionar las cuentas registradas, cambiar roles, vincular cuidadores con pacientes y auditar el mapa global, **para** garantizar la seguridad y administración de la plataforma. |
| **CU-09** | Monitoreo Preventivo Sin Parche (Wearable: Pulso + Temperatura) con Alarma Simultánea 60s | Paciente / Cuidador | **HU-09** | **Como** paciente con diabetes y cuidador, **quiero** conectar un reloj inteligente, anillo o banda para detectar alteraciones de ritmo cardíaco y temperatura corporal asociadas a bajadas o subidas de azúcar, **para** disparar una alarma simultánea y enviar automáticamente la ubicación GPS y los síntomas al cuidador si el paciente no confirma estar bien en 1 minuto. |

---

## 2. Historias de Aceptación (Criterios Dado / Cuando / Entonces)

### HU-01: Registro y Vinculación Paciente–Cuidador en Vivo
- **Escenario 1 (Registro de un nuevo Paciente / Profesor en sustentación):**
  - **Dado** que un usuario selecciona la pestaña *"Crear cuenta"* y el rol **`Paciente`**,
  - **Cuando** ingresa su nombre, correo y contraseña y envía el formulario,
  - **Entonces** el sistema crea su cuenta en Supabase/local, le genera automáticamente un código único **`DM-XXXX`**, lo muestra en su panel simplificado y lo habilita para ser vinculado por un cuidador.
- **Escenario 2 (Registro o Login de Cuidador vinculado):**
  - **Dado** que un familiar o profesor selecciona el rol **`Cuidador`**,
  - **Cuando** ingresa el código `DM-8492` (Damián Díaz Balseiro) o el código `DM-XXXX` recién generado por otro profesor paciente,
  - **Entonces** el sistema vincula al cuidador con ese paciente y abre el panel completo de supervisión clínica y geocercas.
- **Escenario 3 (Acceso exclusivo de Administrador):**
  - **Dado** que un usuario selecciona el rol **`Admin`**,
  - **Cuando** ingresa el código de autorización `DIAMON-ADMIN-2026`,
  - **Entonces** el sistema habilita el botón y acceso a `pages/admin.html` y `pages/mapa-admin.html`.

### HU-02 y HU-03: Evaluación Clínica de Glucosa y Presión Arterial
- **Escenario 1 (Glucosa en rango o fuera de meta):**
  - **Dado** que el paciente tiene configurada una meta de glucosa de `80–180 mg/dL`,
  - **Cuando** registra una lectura de `64 mg/dL` (hipoglucemia) o `250 mg/dL` (hiperglucemia crítica),
  - **Entonces** el servicio de dominio (`EvaluadorClinicoDomainService`) clasifica el estado en rojo, muestra el protocolo de la **Regla 15-15** o hidratación, guarda el registro en `glucosa_lecturas` (Supabase/SQLite) y emite una alerta sonora y visual en la bandeja de 24 horas.
- **Escenario 2 (Crisis hipertensiva):**
  - **Dado** que la meta de presión arterial es `< 140/90 mmHg`,
  - **Cuando** se registra una toma de `164/96 mmHg`,
  - **Entonces** el sistema marca *"Crisis Hipertensiva"*, recomienda verificar la toma de Valsartán (2:00 PM) y Nifedipina (8:00 AM / 8:00 PM) y notifica al cuidador.

### HU-04: Monitoreo GPS y Alerta por Salida de Geocerca
- **Escenario 1 (Dentro de zona segura):**
  - **Dado** que la geocerca del paciente está centrada en el Barrio Chapacuá (`Lat: 10.39991, Lng: -75.47886`) con radio de `400 metros`,
  - **Cuando** el GPS reporta una distancia menor o igual a `400m`,
  - **Entonces** el indicador muestra *"En zona segura"* en color verde esmeralda.
- **Escenario 2 (Violación de geocerca):**
  - **Dado** que el paciente se desplaza o transmite coordenadas a más de `400 metros` del centro configurado,
  - **Cuando** el motor geométrico Haversine calcula una distancia superior al radio permitido (ej. `715m`),
  - **Entonces** el sistema cambia el estado a *"Fuera de Zona"*, dibuja la alerta en el mapa Leaflet y registra la incidencia en la tabla `alertas`.

### HU-05 y HU-07: Adherencia a Medicamentos y Vista Simplificada del Paciente
- **Escenario 1 (Confirmación de toma desde Vista Simplificada):**
  - **Dado** que el paciente ingresa con su rol de **`Paciente`** o abre la **`Vista Simple`**,
  - **Cuando** presiona el botón *"YA TOMÉ MIS MEDICAMENTOS / INSULINA"*,
  - **Entonces** el sistema registra la hora exacta de la confirmación y envía una notificación de tranquilidad al panel del cuidador.

### HU-08: Gestión Exclusiva del Administrador
- **Escenario 1 (CRUD y cambio de roles en Panel Admin):**
  - **Dado** que el usuario inició sesión con rol **`Admin`**,
  - **Cuando** ingresa a `pages/admin.html`,
  - **Entonces** puede buscar usuarios por nombre o correo, crear nuevos perfiles, cambiar su rol (`monitoreado`, `cuidador`, `admin`), vincular un cuidador con el paciente del caso de estudio y consultar los KPIs globales de la base de datos Supabase.

### HU-09: Detección Preventiva Sin Parche (Ritmo Cardíaco + Temperatura) y Escalamiento en 1 Minuto
- **Escenario 1 (Confirmación a tiempo — «Estoy bien»):**
  - **Dado** que el paciente tiene conectado un reloj inteligente, anillo o simulador biométrico con línea base de `72 BPM` y `36.5 °C`,
  - **Cuando** se detecta alteración compatible con posible bajada de azúcar (`114 BPM` y `35.5 °C`) o subida de azúcar (`108 BPM` y `38.2 °C`),
  - **Entonces** el sistema dispara una **alarma en simultáneo** al paciente y al cuidador con cuenta regresiva de **60 segundos**; si el paciente pulsa **«ESTOY BIEN»** antes del minuto, el escalamiento se cancela y el cuidador recibe la confirmación inmediata.
- **Escenario 2 (Sin respuesta tras 1 minuto — Escalamiento automático con GPS y síntomas):**
  - **Dado** que se activó la alarma preventiva simultánea y el temporizador de **1 minuto (60s)** llega a `00:00` sin respuesta del paciente,
  - **Entonces** el cuidador recibe automáticamente la **ubicación GPS exacta** (barrio, coordenadas, botón de mapa y Google Maps) junto con el **reporte completo de síntomas biométricos** detectados por el wearable.

---

## 3. Matriz Aplicación vs. Casos de Uso (Demostración en Vivo)

Esta tabla sirve como guía durante la sustentación para mostrarle al profesor **dónde se ejecuta cada Caso de Uso dentro de la aplicación Web y la App Móvil Android**:

| Caso de Uso | Vista / Archivo en la Aplicación | Archivos de Código (Arquitectura Hexagonal + Adaptadores) | Cómo demostrarlo en vivo ante el jurado |
| :--- | :--- | :--- | :--- |
| **CU-01: Registro y Login por Rol (Paciente, Cuidador, Admin)** | `pages/login.html` | `assets/js/auth-modern.js` + `assets/js/supabase-client.js` | 1.Un profesor se registra en vivo como **Paciente** → recibe su código `DM-XXXX`.<br>2. Otro profesor se registra como **Cuidador** colocando ese código `DM-XXXX` (o `DM-8492` de Don Damián) → queda vinculado.<br>3. Ingresar con código `DIAMON-ADMIN-2026` en rol **Admin**. |
| **CU-02 y CU-03: Registro de Glucosa y Presión Arterial** | `pages/index.html` (Botón *"Registrar Glucosa / Presión"*) y App Android (`ActividadCrudClinico`) | `src/domain/services/EvaluadorClinicoDomainService.js`, `src/application/usecases/MonitorearPacienteUseCase.js`, `assets/js/caso-estudio.js` | Hacer clic en *"Registrar Glucosa / Presión"*, ingresar `114 mg/dL` o `64 mg/dL` y ver cómo cambia el KPI, la bitácora clínica y se guarda en Supabase (`glucosa_lecturas` / `presion_arterial`). |
| **CU-04: Monitoreo GPS en Tiempo Real y Geocercas** | `pages/index.html` (Mapa GPS) y `pages/zonas-seguras.html` | `assets/js/map.js`, `assets/js/zonas-seguras.js`, `assets/js/caso-estudio.js` | Presionar *"Transmitir GPS Real"* para enviar la ubicación del celular/portátil en vivo, o ir a `zonas-seguras.html` para ajustar el radio de 400m en Chapacuá. |
| **CU-05: Control de Medicamentos e Insulina 24 UI** | `pages/index.html` (Pestaña *"Medicamentos"*) | `assets/js/medicamentos.js`, `assets/js/caso-estudio.js` | Mostrar los 5 bloques horarios reales de Don Damián (8 AM, 2 PM, 8 PM, 9 PM Insulina 24 UI y Sábados Ozempic) y marcar una dosis como tomada. |
| **CU-06: Emergencia SOS y Ficha Médica QR** | `pages/index.html` (Botón QR en barra superior / Botón SOS) y `pages/ficha-emergencia.html` | `assets/js/medical-qr.js`, `assets/js/voz-sos.js` | Abrir el icono de **Código QR** en la barra superior para escanear la ficha de emergencia con el celular, o activar el botón rojo SOS. |
| **CU-07: Interfaz Simplificada del Paciente** | `pages/index.html` (Al entrar como **Paciente** + botón *"Vista Simple"*) | `assets/js/dashboard-controller.js`, `assets/js/caso-estudio.js` | Iniciar sesión como **Paciente** para ver el panel limpio sin controles complejos de geocercas/admin, y pulsar *"Vista Simple"* para abrir la botonera grande de 4 acciones. |
| **CU-08: Gestión de Usuarios y Roles (Exclusivo Admin)** | `pages/admin.html` y `pages/mapa-admin.html` | `assets/js/admin.js` | Iniciar sesión como **Admin**, abrir *"Gestión de Usuarios (Admin)"*, buscar o crear un usuario, cambiar su rol y vincularlo a un paciente. |
| **CU-09: Monitor Preventivo Sin Parche (Wearable BLE / API) + Alarma 60s** | `pages/index.html` (Pestaña *"Monitor Wearable"* y tarjeta en Inicio) | `src/domain/services/DetectorGlucemicoPreventivoService.js`, `src/application/usecases/MonitorearBiometriaPreventivaUseCase.js`, `src/infrastructure/adapters/WebBluetoothWearableAdapter.js`, `assets/js/monitoreo-preventivo-wearable.js`, `api/wearable.js` | Entrar a **Monitor Wearable**, pulsar *"Posible Bajada de Azúcar"* (`114 BPM · 35.5 °C`) o enviar `POST /api/wearable`, mostrar la alarma simultánea de 60 segundos, probar *"Estoy bien"* y luego el vencimiento de 1 minuto donde el cuidador recibe GPS + síntomas. |
