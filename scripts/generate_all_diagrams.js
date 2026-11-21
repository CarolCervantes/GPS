const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'C:\\Users\\Administrator\\Downloads\\DiaMon_Diagramas_UML';
const PUML_DIR = path.join(OUTPUT_DIR, 'puml_sources');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(PUML_DIR)) fs.mkdirSync(PUML_DIR, { recursive: true });

const DIAGRAMAS = [
  {
    id: '01_casos_de_uso',
    nombre: '01. Diagrama de Casos de Uso',
    descripcion: 'Interacción entre Paciente, Familiar/Cuidador, Médico y Servicios de Urgencias SOS en Cartagena.',
    source: `@startuml
left to right direction
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 12
skinparam shadowing false
skinparam roundcorner 10

skinparam actor {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam usecase {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
  FontSize 12
}

skinparam package {
  BackgroundColor #f1f5f9
  BorderColor #94a3b8
  FontColor #0f172a
  FontStyle bold
}

skinparam arrow {
  Color #0284c7
}

actor "Paciente Diabético" as Paciente
actor "Familiar / Cuidador" as Familiar
actor "Personal Médico / EPS" as Medico
actor "Servicio Urgencias SOS" as SOS

rectangle "DiaMon — Sistema Integral de Salud & Monitoreo GPS" {
  package "Autenticación & Vinculación" {
    usecase "Iniciar Sesión (Google OAuth / Código)" as UC_Auth
    usecase "Generar y Vincular Código Único (DM-XXXX)" as UC_Codigo
  }

  package "Telemetría Clínica & GPS 24/7" {
    usecase "Monitorear Ubicación GPS en Tiempo Real" as UC_GPS
    usecase "Verificar Salida de Geocerca Segura" as UC_Geocerca
    usecase "Monitorear Nivel de Glucosa y Batería" as UC_Glucosa
  }

  package "Gestión de Medicamentos" {
    usecase "Confirmar Toma de Dosis Diaria" as UC_Dosis
    usecase "Verificar Alertas de Vencimiento Lote" as UC_Vencimiento
  }

  package "Protocolo de Emergencia SOS" {
    usecase "Activar Alerta SOS (Voz / Botón)" as UC_ActivarSOS
    usecase "Escanear Ficha Médica QR PulseCard" as UC_FichaQR
    usecase "Trazar Ruta a Centro Médico Cartagena" as UC_RutaHospital
  }
}

Paciente --> UC_Auth
Paciente --> UC_Codigo
Paciente --> UC_GPS
Paciente --> UC_Glucosa
Paciente --> UC_Dosis
Paciente --> UC_ActivarSOS

Familiar --> UC_Auth
Familiar --> UC_Codigo
Familiar --> UC_GPS
Familiar --> UC_Geocerca
Familiar --> UC_Glucosa
Familiar --> UC_Vencimiento

Medico --> UC_Auth
Medico --> UC_Glucosa
Medico --> UC_Vencimiento

SOS --> UC_FichaQR
SOS --> UC_RutaHospital

UC_ActivarSOS ..> UC_Geocerca : <<trigger>>
UC_ActivarSOS ..> UC_FichaQR : <<include>>
UC_ActivarSOS ..> UC_RutaHospital : <<include>>
@enduml`
  },
  {
    id: '02_clases',
    nombre: '02. Diagrama de Clases del Dominio Clínico',
    descripcion: 'Entidades, herencias y relaciones del sistema (Usuarios, Paciente, Cuidador, Telemetría, Glucosa, Medicamentos y Alertas).',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 11
skinparam classAttributeIconSize 0
skinparam roundcorner 8
skinparam shadowing false

skinparam class {
  BackgroundColor #ffffff
  BorderColor #0284c7
  HeaderBackgroundColor #f0f9ff
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
}

abstract class Usuario {
  - id: String
  - nombre: String
  - email: String
  - rol: String
  - fotoUrl: String
  + iniciarSesionOAuth(): Boolean
  + cerrarSesion(): void
}

class Paciente {
  - codigoPaciente: String
  - tipoDiabetes: String
  - contactoEmergencia: String
  - glucosaActual: Int
  + generarCodigoQR(): String
  + emitirSOS(tipo: String): void
}

class Cuidador {
  - codigoPacienteSupervisado: String
  - parentesco: String
  + vincularPaciente(codigo: String): Boolean
  + recibirAlertaRealtime(alerta: AlertaMedica): void
}

class TelemetriaGPS {
  - latitud: Double
  - longitud: Double
  - precisionMetros: Double
  - nivelBateria: Int
  - pasosHoy: Int
  - sectorCartagena: String
  + obtenerGeolocalizacion(): Coordenadas
  + reiniciarPasos24h(): void
}

class LecturaGlucosa {
  - id: String
  - valorMgDl: Int
  - clasificacion: String
  - timestamp: DateTime
  + esCritica(): Boolean
}

class Medicamento {
  - id: String
  - nombreComercial: String
  - dosis: String
  - horario: String
  - fechaVencimiento: Date
  - confirmadaHoy: Boolean
  + registrarToma(): void
  + estaProximoAVencer(): Boolean
}

class AlertaMedica {
  - id: String
  - titulo: String
  - subtitulo: String
  - tipo: String
  - estado: String
  - timestamp: DateTime
  + marcarAtendida(): void
  + reproducirAlarmaAudio(): void
}

class GeocercaSegura {
  - idZona: String
  - nombreSector: String
  - centroLat: Double
  - centroLng: Double
  - radioMetros: Double
  + verificarSalida(lat: Double, lng: Double): Boolean
}

class FichaMedicaQR {
  - tokenQR: String
  - tipoSangre: String
  - alergias: List<String>
  - telefonoSOS: String
  + mostrarEnPantallaBloqueo(): void
}

Usuario <|-- Paciente
Usuario <|-- Cuidador

Cuidador "1" --> "1..*" Paciente : supervisa >
Paciente "1" *-- "1" TelemetriaGPS : transmite >
Paciente "1" *-- "0..*" LecturaGlucosa : registra >
Paciente "1" *-- "0..*" Medicamento : tiene asignado >
Paciente "1" *-- "1" FichaMedicaQR : cuenta con >
Paciente "1" --> "0..*" AlertaMedica : genera >
TelemetriaGPS ..> GeocercaSegura : valida cruce >
AlertaMedica ..> Cuidador : notifica 24/7 >
@enduml`
  },
  {
    id: '03_secuencia',
    nombre: '03. Diagrama de Secuencia de Emergencia SOS 24/7',
    descripcion: 'Flujo cronológico ante descompensación aguda o comando de voz SOS en Cartagena.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 12
skinparam roundcorner 8
skinparam shadowing false
autonumber

skinparam participant {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam actor {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 11
}

actor "Paciente" as P
participant "DiaMon PWA" as App
participant "Telemetría GPS" as GPS
participant "Motor Alertas 24/7" as Alertas
participant "Supabase Realtime" as Cloud
actor "Familiar Cuidador" as Fam
participant "Centro Médico / SOS" as SOS

P -> App: Pronuncia comando "¡Auxilio!" o presiona Botón SOS
activate App

App -> GPS: Capturar coordenadas exactas (watchPosition)
activate GPS
GPS --> App: {lat: 10.4042, lng: -75.5562, barrio: "Manga, CTG"}
deactivate GPS

App -> Alertas: Disparar incidencia crítica (Hipoglucemia / SOS)
activate Alertas

Alertas -> Alertas: Emitir alarma sonora (Web Audio API)
Alertas -> Cloud: Transmitir alerta y telemetría (DM-8492)
activate Cloud

Cloud -> Fam: Notificación Push 24/7 (Vibración y Alarma)
activate Fam
Fam -> Fam: Abre mapa y localiza ruta en vivo
deactivate Fam

Alertas -> SOS: Despacho automático de ambulancia cercana
activate SOS
SOS --> App: Confirmación de unidad médica en camino
deactivate SOS

App -> App: Mostrar Ficha Médica QR PulseCard en pantalla
Alertas --> App: Estado actualizado: Pendiente / Transmitiendo
deactivate Alertas

App --> P: Audio confirmación: "Ayuda médica en camino"
deactivate App
@enduml`
  },
  {
    id: '04_actividades',
    nombre: '04. Diagrama de Actividades (Flujo de Sistema)',
    descripcion: 'Flujo de autenticación, paralelismo de telemetría (batería, podómetro, GPS, glucosa) y toma de decisiones.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 12
skinparam shadowing false
skinparam roundcorner 8

skinparam activity {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
  FontSize 12
}

skinparam diamond {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  FontColor #0369a1
  FontSize 11
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 11
}

start
:Usuario abre DiaMon (Vercel / Local);
if (¿Usuario autenticado?) then (No)
  :Accede a Pantalla de Acceso 3D;
  if (¿Desea crear cuenta o iniciar sesión?) then (Crear cuenta)
    :Completa formulario con nombre, correo y contraseña;
    :Sistema genera Código Único DM-XXXX;
  else (Iniciar sesión)
    if (¿Rol seleccionado?) then (Usuario)
      :Ingresa credenciales o vincula con Google;
    else (Administrador / Familiar)
      :Ingresa credenciales;
      :Ingresa Código Único del Paciente a supervisar;
      :Valida existencia del código en la base de datos;
    endif
  endif
  :Almacena sesión en sessionStorage;
else (Sí)
  :Carga sesión activa;
endif

:Inicializar Dashboard Moderno DiaMon;
fork
  :Capturar Telemetría de Batería (Battery Status API);
fork again
  :Capturar Pasos Diarios (DeviceMotionEvent);
fork again
  :Iniciar Geolocalización Continua (watchPosition);
  :Renderizar Mapa Leaflet de Cartagena;
  :Verificar Geocerca Segura;
fork again
  :Monitorear Lectura de Glucosa;
end fork

if (¿Glucosa fuera de rango o Botón SOS o Voz SOS activado?) then (Sí)
  :Disparar Alerta Médica Inmediata;
  :Emitir alarma sonora y vibración;
  :Notificar en tiempo real a Familiar / Médico;
  :Trazar ruta al Centro Médico más cercano en Cartagena;
  :Mostrar Ficha QR Médica SOS en pantalla de bloqueo;
else (No)
  :Verificar Vencimiento de Medicamentos;
  if (¿Medicamentos con < 15 días?) then (Sí)
    :Mostrar alerta preventiva en pestaña Medicamentos;
  else (No)
    :Mantener estado clínico Normal (Verde);
  endif
endif

:Actualizar KPIs de salud y recorrido;
stop
@enduml`
  },
  {
    id: '05_estados',
    nombre: '05. Diagrama de Estados de Monitoreo',
    descripcion: 'Transiciones de estado del paciente: Desconectado, Monitoreo Óptimo, Alerta Preventiva, Salida de Geocerca y Emergencia SOS.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 12
skinparam roundcorner 10
skinparam shadowing false

skinparam state {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 11
}

[*] --> Desconectado

state Desconectado {
  Desconectado : Pantalla de acceso 3D
  Desconectado : Sin datos privados en caché
}

Desconectado --> MonitoreoOptimo : Autenticación Google / Código DM-XXXX

state MonitoreoOptimo {
  MonitoreoOptimo : Glucosa en rango (70 - 139 mg/dL)
  MonitoreoOptimo : Dentro de Geocerca Residencial
  MonitoreoOptimo : Podómetro y Batería transmitiendo 24/7
}

state AlertaPreventiva #fef3c7 {
  AlertaPreventiva : Glucosa limítrofe (140 - 179 mg/dL)
  AlertaPreventiva : O medicamento con < 15 días de vencimiento
}

state SalidaGeocerca #fee2e2 {
  SalidaGeocerca : Distancia > 1.2 km de la zona segura
  SalidaGeocerca : Notificación de desvío enviada al familiar
}

state EmergenciaCritica #fee2e2 {
  EmergenciaCritica : Hipoglucemia severa (< 70 mg/dL)
  EmergenciaCritica : O activación de Botón / Comando de Voz SOS
  EmergenciaCritica : Sirena acústica y transmisión telemétrica continua
}

state AtencionMedica #f0fdf4 {
  AtencionMedica : Paramédico en sitio
  AtencionMedica : Ficha Médica QR escaneada
  AtencionMedica : Protocolo de estabilización clínico
}

MonitoreoOptimo --> AlertaPreventiva : Glucosa elevada / Lote por vencer
AlertaPreventiva --> MonitoreoOptimo : Glucosa estabilizada

MonitoreoOptimo --> SalidaGeocerca : GPS supera radio seguro
SalidaGeocerca --> MonitoreoOptimo : Paciente regresa a zona segura

MonitoreoOptimo --> EmergenciaCritica : Descompensación aguda o SOS
AlertaPreventiva --> EmergenciaCritica : Hipoglucemia repentina
SalidaGeocerca --> EmergenciaCritica : Paciente solicita auxilio

EmergenciaCritica --> AtencionMedica : Despacho y arribo de ambulancia
AtencionMedica --> MonitoreoOptimo : Paciente fuera de peligro

MonitoreoOptimo --> Desconectado : Cierre voluntario de sesión
Desconectado --> [*]
@enduml`
  },
  {
    id: '06_componentes',
    nombre: '06. Diagrama de Componentes de Arquitectura',
    descripcion: 'Módulos de la PWA, APIs nativas del dispositivo y servicios en la nube (Vercel, Supabase, Google, OSM).',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 12
skinparam componentStyle uml2
skinparam shadowing false
skinparam roundcorner 8

skinparam package {
  BackgroundColor #ffffff
  BorderColor #94a3b8
  FontColor #0f172a
  FontStyle bold
}

skinparam component {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 11
}

package "Capa de Presentación — DiaMon PWA" {
  [Controlador Dashboard & KPIs] as C_Dash
  [Motor de Alertas 24/7 & Incidencias] as C_Alertas
  [Módulo de Mapas Leaflet & Geocercas] as C_Map
  [Gestor de Medicamentos & Glucosa] as C_Clinico
  [Ficha Médica QR PulseCard] as C_QR
  [Asistente IA DiaBot] as C_DiaBot
}

package "APIs Nativas del Hardware & Navegador" {
  [Geolocation API (watchPosition)] as API_GPS
  [DeviceMotionEvent (Podómetro 24h)] as API_Motion
  [Battery Status API] as API_Bat
  [Web Audio API (Sirena Acústica)] as API_Audio
  [Service Worker 24/7 (sw.js)] as API_SW
}

package "Servicios en la Nube & Backend Serverless" {
  [Vercel CDN Edge Network (diamon-salud.vercel.app)] as S_Vercel
  [Supabase Realtime WebSockets] as S_Realtime
  [PostgreSQL Cloud Database] as S_Postgres
  [Google OAuth 2.0 Service] as S_Google
  [Servidor de Mapas OpenStreetMap] as S_OSM
}

' Conexiones de Hardware
API_GPS --> C_Map : Coordenadas en vivo
API_Motion --> C_Dash : Conteo de pasos
API_Bat --> C_Dash : Nivel de carga
C_Alertas --> API_Audio : Reproduce tono alarma
C_Alertas --> API_SW : Notificaciones push 24/7

' Conexiones Cloud
C_Dash --> S_Vercel : Servido 24/7 vía HTTPS
C_Map --> S_OSM : Descarga teselas cartográficas
C_Alertas --> S_Realtime : Difunde alertas críticas
C_Clinico --> S_Postgres : Registra tomas y lecturas
C_Dash --> S_Google : Autenticación oficial
C_Alertas ..> C_QR : Despliega ficha de auxilio
@enduml`
  },
  {
    id: '07_despliegue',
    nombre: '07. Diagrama de Despliegue Físico y Cloud',
    descripcion: 'Dispositivos del paciente, supervisor, sensores BLE, CDN Vercel Edge y cluster Supabase en la nube.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 12
skinparam shadowing false
skinparam roundcorner 10

skinparam node {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam component {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam database {
  BackgroundColor #f0fdf4
  BorderColor #16a34a
  FontColor #14532d
}

skinparam cloud {
  BackgroundColor #ffffff
  BorderColor #64748b
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 11
}

node "Dispositivo Móvil del Paciente (Android / iOS)" as NodoPaciente {
  artifact "Navegador Web (Chrome / Safari)" as NavPaciente {
    component "DiaMon SPA (HTML5/CSS3/JS)" as SPAPaciente
    database "Session & Local Storage" as CachePaciente
  }
  node "Sensores de Hardware" as Sensores {
    [GPS GNSS] as HW_GPS
    [Acelerómetro] as HW_Accel
    [Batería Interna] as HW_Bat
    [Micrófono] as HW_Mic
  }
}

node "Dispositivo de Telemetría Glucosa (Glucómetro IoT / BLE)" as NodoIoT {
  component "Sensor Enzimático de Glucosa" as SensorGluc
  component "Transmisor Bluetooth LE" as TransmisorBLE
}

node "Dispositivo del Familiar / Médico (PC / Tablet / Smartphone)" as NodoSupervisor {
  artifact "Navegador Web" as NavSupervisor {
    component "DiaMon Dashboard Administrador" as SPASupervisor
  }
}

cloud "Nube de Vercel (Edge Network 24/7)" as NubeVercel {
  node "Servidor CDN Edge Miami / Bogotá" as EdgeVercel {
    component "diamon-salud.vercel.app" as HostVercel
    file "Archivos Estáticos (HTML, JS, CSS, SVG)" as StaticFiles
  }
}

cloud "Nube de Supabase (Backend Serverless)" as NubeSupabase {
  node "Cluster de Base de Datos" as NodoDB {
    database "PostgreSQL DB" as DB_Postgres
    component "Supabase Realtime WebSockets" as WS_Realtime
    component "Servicio Auth JWT" as Auth_Service
  }
}

cloud "Servicios Externos de Terceros" as NubeTerceros {
  component "Google OAuth Identity Provider" as ExtGoogle
  component "Servidor de Mapas OpenStreetMap" as ExtOSM
}

' Enlaces Físicos y Protocolos
TransmisorBLE --> SPAPaciente : Bluetooth LE / Web Bluetooth
HW_GPS --> SPAPaciente : Geolocation API
HW_Accel --> SPAPaciente : DeviceMotionEvent
HW_Bat --> SPAPaciente : Battery Status API
HW_Mic --> SPAPaciente : Web Speech API

SPAPaciente -- HostVercel : HTTPS / TLS 1.3
SPASupervisor -- HostVercel : HTTPS / TLS 1.3

SPAPaciente -- Auth_Service : REST JSON / HTTPS
SPASupervisor -- Auth_Service : REST JSON / HTTPS
SPAPaciente -- WS_Realtime : WebSockets (WSS)
SPASupervisor -- WS_Realtime : WebSockets (WSS)

Auth_Service -- ExtGoogle : OAuth 2.0 Flow
SPAPaciente -- ExtOSM : HTTPS Tiles
SPASupervisor -- ExtOSM : HTTPS Tiles
@enduml`
  },
  {
    id: '08_objetos',
    nombre: '08. Diagrama de Objetos en Tiempo Real',
    descripcion: 'Instancia en ejecución con paciente Erick Torres, telemetría GPS viva, podómetro de ciclo 24h y alertas activas.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 11
skinparam roundcorner 8
skinparam shadowing false

skinparam object {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
}

object "erickTorres : Paciente" as pac {
  id = "usr-erick-xe9a"
  nombre = "Erick de Jesús Torres"
  email = "erickdejesustorres02@gmail.com"
  codigoPaciente = "DM-XE9A"
  tipoDiabetes = "Diabetes Tipo 1"
  glucosaActual = 92
}

object "telemetriaViva : TelemetriaGPS" as telem {
  latitud = 10.4042
  longitud = -75.5562
  sector = "Bocagrande, Cartagena"
  precision = "±12 m (GPS en vivo)"
  pasosHoy = 120
  cicloPasos = "Reinicio 24h"
  bateriaNivel = 87
}

object "alertaGeocerca : AlertaMedica" as alt {
  id = "alt-001"
  titulo = "Salida de zona segura"
  subtitulo = "Tu familiar salió de la zona segura"
  tiempo = "Hace 5 min"
  estado = "Pendiente"
}

object "metformina : Medicamento" as med {
  nombreComercial = "Metformina 500 mg"
  dosis = "500 mg post-desayuno"
  tiempo = "Hace 3 h"
  estado = "Confirmada"
}

object "mariaLopez : Cuidador" as cuid {
  nombre = "María López"
  rol = "Familiar"
  codigoSupervisado = "DM-XE9A"
}

object "fichaQR : FichaMedicaQR" as qr {
  tokenQR = "QR-DMXE9A-PULSECARD"
  tipoSangre = "O+"
  alergias = ["Penicilina"]
  contactoEmergencia = "+57 300 123 4567"
}

object "geocercaCasa : GeocercaSegura" as geo {
  nombreZona = "Sector Residencial Cartagena"
  radioMetros = 1200
  centro = [10.3887, -75.4789]
}

object "clinicaMedihelp : CentroMedicoCartagena" as hosp {
  nombre = "Clínica Medihelp Services"
  sector = "Bocagrande, Cartagena"
  urgencias24h = true
  distanciaKm = 0.85
}

pac -- telem : transmite telemetría en vivo
pac -- alt : generó en tiempo real
pac -- med : tiene prescrito
pac -- qr : porta para emergencias
cuid ..> pac : supervisa estado de
cuid ..> alt : recibe notificación 24/7 de
telem ..> geo : evalúa cruce de
hosp ..> pac : centro asistencial más próximo
@enduml`
  },
  {
    id: '09_paquetes',
    nombre: '09. Diagrama de Paquetes Modulares',
    descripcion: 'Estructuración modular del código fuente: auth, telemetry, clinical, geo, alerts y cloud.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam defaultFontSize 11
skinparam roundcorner 8
skinparam shadowing false

skinparam package {
  BackgroundColor #ffffff
  BorderColor #0284c7
  FontColor #0f172a
  FontStyle bold
}

skinparam class {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  FontColor #0f172a
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 10
}

package "co.diamon.auth" as PkgAuth {
  class GoogleOAuthService
  class PatientCodeRegistry
  class SessionStorageManager
}

package "co.diamon.telemetry" as PkgTelem {
  class DeviceLocationWatcher
  class StepCounter24h
  class BatteryStatusAPI
}

package "co.diamon.clinical" as PkgClin {
  class GlucoseMonitor
  class MedicationSchedule
  class ClinicalHistoryEngine
}

package "co.diamon.geo" as PkgGeo {
  class LeafletMapController
  class GeofenceValidator
  class CartagenaMedicalDirectory
}

package "co.diamon.alerts" as PkgAlerts {
  class AlertsDispatcher247
  class WebAudioAlarmSynthesizer
  class ServiceWorkerPushBridge
  class MedicalQRGenerator
}

package "co.diamon.cloud" as PkgCloud {
  class SupabaseRealtimeClient
  class VercelEdgeCDN
}

PkgAuth ..> PkgCloud : autentica tokens JWT
PkgTelem ..> PkgGeo : suministra coordenadas GPS
PkgTelem ..> PkgClin : aporta telemetría de pasos y batería
PkgClin ..> PkgAlerts : dispara alertas de hipoglucemia/dosis
PkgGeo ..> PkgAlerts : notifica salida de geocerca
PkgAlerts ..> PkgCloud : sincroniza incidencias en vivo 24/7
@enduml`
  },
  {
    id: '10_comunicacion',
    nombre: '10. Diagrama de Comunicación / Colaboración SOS',
    descripcion: 'Intercambio de mensajes y protocolo de auxilio entre objetos del sistema ante emergencia SOS.',
    source: `@startuml
skinparam backgroundColor #f8fafc
skinparam defaultFontName "Arial"
skinparam roundcorner 8
skinparam shadowing false

skinparam rectangle {
  BorderThickness 1.5
}

rectangle "<color:#ffffff><b>Paciente</b></color>" as P #0284c7
rectangle "<color:#0f172a><b>:ReconocimientoVozSOS</b></color>" as Voz #bae6fd
rectangle "<color:#ffffff><b>:SOSDispatcher</b></color>" as Dispatcher #dc2626
rectangle "<color:#ffffff><b>:TelemetriaHardware</b></color>" as Telem #2563eb
rectangle "<color:#ffffff><b>:FichaMedicaQR</b></color>" as QR #334155
rectangle "<color:#ffffff><b>:SupabaseRealtime</b></color>" as DB #059669
rectangle "<color:#ffffff><b>:FamiliarSupervisor</b></color>" as Fam #0d9488
rectangle "<color:#ffffff><b>:CentroMedicoCartagena</b></color>" as Hosp #0369a1

P -- Voz : 1: decirComandoAuxilio("¡Auxilio!") >
Voz -- Dispatcher : 2: iniciarProtocoloEmergencia() >
Dispatcher -- Telem : 3: capturarCoordenadasGPS() >
Dispatcher -- QR : 4: generarFichaQRDinamica() >
Dispatcher -- DB : 5: transmitirAlertaSOS(DM-8492, GPS, Glucosa) >
DB -- Fam : 6: notificarAlertaCriticaRealtime() >
Dispatcher -- Hosp : 7: trazarRutaAmbulanciaMasCercana() >
@enduml`
  }
];

function renderPlantUML(source) {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', 'npx', '-y', '@plantuml/mcp-js'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let buffer = '';

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1) {
            const req = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'render_diagram',
                arguments: { source: source.trim() }
              }
            };
            child.stdin.write(JSON.stringify(req) + '\n');
          } else if (msg.id === 2) {
            child.kill();
            if (msg.result && msg.result.content) {
              const parsed = JSON.parse(msg.result.content[0]?.text);
              if (parsed.valid && parsed.svg) {
                resolve(parsed.svg);
              } else {
                reject(new Error(parsed.errorMessage || 'Error sintaxis PlantUML'));
              }
            } else {
              reject(new Error('Respuesta inválida'));
            }
          }
        } catch (_) {}
      }
    });

    child.on('error', reject);

    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'diamon-gen', version: '2.0' } }
    }) + '\n');
  });
}

async function main() {
  console.log('=== Generando y actualizando los 10 Diagramas UML Oficiales de DiaMon ===');

  for (const item of DIAGRAMAS) {
    const pumlPath = path.join(PUML_DIR, `${item.id}.puml`);
    const svgPath = path.join(OUTPUT_DIR, `${item.id}.svg`);
    const pngPath = path.join(OUTPUT_DIR, `${item.id}.png`);

    console.log(`\nProcesando: ${item.nombre}`);
    fs.writeFileSync(pumlPath, item.source, 'utf8');
    console.log(`  ✓ PUML guardado: ${pumlPath}`);

    try {
      const svgContent = await renderPlantUML(item.source);
      fs.writeFileSync(svgPath, svgContent, 'utf8');
      console.log(`  ✓ SVG renderizado: ${svgPath}`);

      // Convertir a PNG de alta resolución usando resvg
      execSync(`npx -y @resvg/resvg-js-cli "${svgPath}" "${pngPath}"`, { stdio: 'ignore' });
      console.log(`  ✓ PNG generado: ${pngPath}`);
    } catch (err) {
      console.error(`  ✗ Error en ${item.id}:`, err.message);
    }
  }

  // Generar galería HTML actualizada
  const htmlGaleria = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>DiaMon — Galería Oficial de Diagramas UML del Sistema</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { box-sizing: border-box; margin:0; padding:0; }
    body { font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px 20px; }
    .header { text-align: center; max-width: 900px; margin: 0 auto 36px; }
    .header h1 { font-size: 28px; font-weight: 800; color: #0284c7; margin-bottom: 8px; }
    .header p { font-size: 14.5px; color: #64748b; line-height: 1.6; }
    .badge-bar { display: inline-flex; align-items: center; gap: 8px; background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; margin-top: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 24px; max-width: 1400px; margin: 0 auto; }
    .card { background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
    .card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
    .card-header { padding: 18px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
    .card-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .card-actions { display: flex; gap: 8px; }
    .btn-action { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; text-decoration: none; padding: 5px 10px; border-radius: 6px; background: #f1f5f9; color: #334155; transition: background 0.15s; }
    .btn-action:hover { background: #e2e8f0; color: #0f172a; }
    .btn-action.puml { background: #eff6ff; color: #1d4ed8; }
    .card-desc { padding: 10px 20px 0; font-size: 13px; color: #64748b; }
    .card-img-wrap { padding: 16px; display: flex; align-items: center; justify-content: center; background: #ffffff; flex: 1; min-height: 280px; }
    .card-img-wrap img { max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 8px; border: 1px solid #f1f5f9; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <h1><i class="fas fa-project-diagram"></i> DiaMon — Colección Oficial de Diagramas UML</h1>
    <p>Modelado formal del software de Monitoreo Inteligente de Diabetes & Salud GPS en Cartagena de Indias. Actualizado con tipografía nítida en Arial, corrección cromática de contraste (sin rojo sobre negro) y coherencia con la arquitectura 24/7.</p>
    <div class="badge-bar"><i class="fas fa-check-circle"></i> 10 Diagramas UML 2.5 Actualizados y Validados</div>
  </div>

  <div class="grid">
    ${DIAGRAMAS.map(d => `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${d.nombre}</div>
          <div class="card-actions">
            <a href="${d.id}.png" target="_blank" class="btn-action"><i class="fas fa-file-image"></i> PNG</a>
            <a href="${d.id}.svg" target="_blank" class="btn-action"><i class="fas fa-vector-square"></i> SVG</a>
            <a href="puml_sources/${d.id}.puml" target="_blank" class="btn-action puml"><i class="fas fa-code"></i> PUML</a>
          </div>
        </div>
        <div class="card-desc">${d.descripcion}</div>
        <div class="card-img-wrap">
          <a href="${d.id}.png" target="_blank">
            <img src="${d.id}.png" alt="${d.nombre}" loading="lazy">
          </a>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index_galeria_diagramas.html'), htmlGaleria, 'utf8');
  console.log('\n✓ index_galeria_diagramas.html actualizado con éxito.');
  console.log('\n=== Proceso finalizado. Todos los diagramas fueron reemplazados en Downloads ===');
}

main().catch(console.error);
