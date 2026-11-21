const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'C:\\Users\\Administrator\\Downloads\\DiaMon_Diagramas_UML';
const PUML_DIR = path.join(OUTPUT_DIR, 'puml_sources');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(PUML_DIR)) fs.mkdirSync(PUML_DIR, { recursive: true });

// Función para invocar el MCP server de PlantUML local
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
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'diamon-hd-gen', version: '2.0' } }
    }) + '\n');
  });
}

const DIAGRAMAS = [
  // ==========================================
  // 01. CASOS DE USO
  // ==========================================
  {
    id: '01_casos_de_uso',
    nombre: '01. Diagrama de Casos de Uso',
    descripcion: 'Interacciones del Paciente Diabético, Familiar/Cuidador, Médico EPS y Servicios de Emergencia SOS con el ecosistema DiaMon.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 14
skinparam roundcorner 12
skinparam shadowing false

skinparam actor {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  BorderThickness 2
  FontColor #0f172a
  FontSize 14
  FontStyle bold
}

skinparam usecase {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
}

skinparam package {
  BackgroundColor #f8fafc
  BorderColor #64748b
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 15
  FontStyle bold
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 12
  Thickness 1.5
}

left to right direction

actor "Paciente Diabético" as Paciente
actor "Familiar / Cuidador" as Familiar
actor "Personal Médico / EPS" as Medico
actor "Servicios de Urgencias SOS" as SOS

rectangle "DiaMon — Sistema Inteligente de Salud & Monitoreo GPS" {
  package "Autenticación & Vinculación" {
    usecase "Iniciar Sesión\\n(Google OAuth / Manual)" as UC_Auth
    usecase "Vincular Código Único\\n(DM-XXXX)" as UC_Codigo
    usecase "Gestionar Perfil y\\nContactos SOS" as UC_Perfil
  }

  package "Telemetría Clínica & GPS 24/7" {
    usecase "Rastrear Ubicación GPS\\nen Tiempo Real" as UC_GPS
    usecase "Supervisar Geocercas\\ny Perímetros Seguros" as UC_Geocerca
    usecase "Registrar Glucosa\\ny Nivel de Batería" as UC_Glucosa
    usecase "Contabilizar Pasos Diarios\\n(Reinicio 24 Horas)" as UC_Pasos
  }

  package "Gestión Terapéutica" {
    usecase "Confirmar Toma\\nde Medicamentos" as UC_Medicamentos
    usecase "Verificar Vencimiento\\nde Fármacos (< 15 días)" as UC_Vencimiento
  }

  package "Protocolo SOS & Emergencias" {
    usecase "Activar Alarma SOS\\n(Botón / Comando Voz)" as UC_SOS
    usecase "Escanear Ficha Médica\\nQR PulseCard" as UC_FichaQR
    usecase "Trazar Ruta Guiada al\\nCentro Médico Cartagena" as UC_RutaHospital
  }
}

' Relaciones Paciente
Paciente --> UC_Auth
Paciente --> UC_Codigo
Paciente --> UC_Perfil
Paciente --> UC_GPS
Paciente --> UC_Glucosa
Paciente --> UC_Pasos
Paciente --> UC_Medicamentos
Paciente --> UC_SOS

' Relaciones Familiar
Familiar --> UC_Auth
Familiar --> UC_Codigo
Familiar --> UC_GPS
Familiar --> UC_Geocerca
Familiar --> UC_Glucosa
Familiar --> UC_Vencimiento

' Relaciones Médico
Medico --> UC_Auth
Medico --> UC_Glucosa
Medico --> UC_Vencimiento

' Relaciones SOS
SOS --> UC_FichaQR
SOS --> UC_RutaHospital

' Relaciones internas
UC_SOS ..> UC_Geocerca : <<dispara>>
UC_SOS ..> UC_FichaQR : <<incluye>>
UC_SOS ..> UC_RutaHospital : <<incluye>>
@enduml`
  },

  // ==========================================
  // 02. CLASES
  // ==========================================
  {
    id: '02_clases',
    nombre: '02. Diagrama de Clases del Dominio Clínico',
    descripcion: 'Estructura orientada a objetos de usuarios, pacientes, telemetría, alertas, medicamentos y geocercas.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam classAttributeIconSize 0
skinparam roundcorner 10
skinparam shadowing false

skinparam class {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  HeaderBackgroundColor #e0f2fe
  FontColor #0f172a
  FontSize 13
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 12
  Thickness 1.5
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
  + recibirNotificacion(alerta: Alerta): void
}

class Medico {
  - tarjetaProfesional: String
  - especialidad: String
  + revisarHistorial(pacienteId: String): List
  + ajustarDosis(medicamentoId: String): void
}

class TelemetriaGPS {
  - latitud: Double
  - longitud: Double
  - precision: Float
  - timestamp: DateTime
  - pasosHoy: Int
  - bateriaNivel: Int
  + capturarGPS(): Coordenadas
  + reiniciarPasos24h(): void
}

class Alerta {
  - id: String
  - tipo: String
  - nivelSeveridad: String
  - mensaje: String
  - fechaHora: DateTime
  - atendida: Boolean
  + dispararAlerta(): void
  + reproducirSirena(): void
  + marcarResuelta(): void
}

class Medicamento {
  - id: String
  - nombre: String
  - dosis: String
  - horario: String
  - fechaVencimiento: Date
  - tomadoHoy: Boolean
  + verificarVencimiento(): Boolean
  + registrarToma(): void
}

class Geocerca {
  - id: String
  - nombre: String
  - latCentro: Double
  - lngCentro: Double
  - radioMetros: Double
  - activa: Boolean
  + estaAdentro(lat: Double, lng: Double): Boolean
}

Usuario <|-- Paciente
Usuario <|-- Cuidador
Usuario <|-- Medico

Paciente "1" *-- "1" TelemetriaGPS : genera continuamente
Paciente "1" o-- "*" Alerta : experimenta
Paciente "1" o-- "*" Medicamento : tiene recetados
Paciente "1" -- "*" Geocerca : tiene asignadas
Cuidador "1" ..> "1" Paciente : supervisa remotamente
Medico "1" ..> "*" Paciente : atiende clínicamente
@enduml`
  },

  // ==========================================
  // 03. SECUENCIA
  // ==========================================
  {
    id: '03_secuencia',
    nombre: '03. Diagrama de Secuencia de Emergencia SOS 24/7',
    descripcion: 'Flujo síncrono y asíncrono activado por voz o botón SOS con telemetría GPS en vivo y despacho a familiares y hospitales en Cartagena.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam roundcorner 8
skinparam shadowing false
autonumber

skinparam participant {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
  FontStyle bold
}

skinparam actor {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
  FontStyle bold
}

skinparam arrow {
  Color #0284c7
  FontColor #1e293b
  FontSize 12
  Thickness 1.5
}

actor "Paciente" as P
participant "DiaMon PWA\\n(Navegador)" as App
participant "Módulo GPS\\n(watchPosition)" as GPS
participant "Motor Alertas 24/7\\n(Web Audio & SW)" as Alertas
participant "Supabase Realtime\\n(Nube WebSockets)" as Cloud
actor "Familiar\\nCuidador" as Fam
participant "Centro Médico\\nCartagena (HUC)" as Hosp

P -> App: Pronuncia "¡Auxilio!" o presiona Botón SOS
activate App

App -> GPS: Solicitar coordenadas GPS exactas
activate GPS
GPS --> App: Coordenadas (Lat 10.4042, Lng -75.5562)
deactivate GPS

App -> Alertas: Disparar Protocolo de Emergencia Activa
activate Alertas

Alertas -> Alertas: Iniciar sirena acústica local (Web Audio API)
Alertas -> Alertas: Activar vibración táctil continua

Alertas -> Cloud: Emitir evento SOS vía WebSocket con GPS
activate Cloud

Cloud -> Fam: Notificación Push 24/7: "Alerta SOS Paciente DM-XE9A"
Cloud -> Hosp: Transmitir telemetría y Ficha Médica QR

Cloud --> Alertas: Confirmación de entrega (200 OK)
deactivate Cloud

Alertas --> App: Mostrar Modal SOS con Ruta al Hospital Naval / HUC
deactivate Alertas

App --> P: Desplegar Ficha QR PulseCard y Mapa de Ruta
deactivate App
@enduml`
  },

  // ==========================================
  // 04. ACTIVIDADES
  // ==========================================
  {
    id: '04_actividades',
    nombre: '04. Diagrama de Actividades (Flujo de Sistema)',
    descripcion: 'Flujo operativo completo desde login, telemetría paralela, podómetro con reinicio 24h, geocercas y protocolo de alerta.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam shadowing false
skinparam roundcorner 10

skinparam activity {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
}

skinparam diamond {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0369a1
  FontSize 12
}

skinparam arrow {
  Color #0284c7
  FontColor #1e293b
  FontSize 12
  Thickness 1.5
}

start
:Usuario abre DiaMon (diamon-salud.vercel.app);

if (¿Existe sesión activa en Storage?) then (No)
  :Mostrar pantalla de autenticación;
  if (¿Método de acceso elegido?) then (Google OAuth 2.0)
    :Autenticar con credencial de Google;
    :Vincular correo oficial y foto de perfil;
  else (Código Único / Manual)
    :Ingresar credenciales o Código DM-XXXX;
  endif
  :Guardar token de sesión activa;
else (Sí)
  :Restaurar datos del usuario autenticado;
endif

:Inicializar Tablero Principal DiaMon;

fork
  :Iniciar Geolocalización en Tiempo Real;
  :Verificar si está dentro de Geocerca Segura;
fork again
  :Monitorear Podómetro (Acelerómetro);
  if (¿Medianoche 00:00:00 o nuevo día?) then (Sí)
    :Reiniciar contador de pasos a 0;
  else (No)
    :Acumular pasos en la ventana de 24 horas;
  endif
fork again
  :Lectura de Nivel de Glucosa y Batería;
fork again
  :Supervisar Estado de Medicamentos;
end fork

if (¿Glucosa Crítica (<70 o >180 mg/dL) o Botón SOS Presionado?) then (Sí)
  :Activar Sirena Sonora y Vibración 24/7;
  :Notificar inmediatamente al Cuidador;
  :Trazar ruta al Centro Médico más cercano en Cartagena;
  :Desplegar Ficha Médica QR PulseCard;
else (No)
  if (¿Medicamento próximo a vencer (<15 días)?) then (Sí)
    :Mostrar banner de advertencia preventiva;
  else (No)
    :Mantener indicador de Salud en Estado Normal;
  endif
endif

:Actualizar Dashboard y Métricas en Pantalla;
stop
@enduml`
  },

  // ==========================================
  // 05. ESTADOS
  // ==========================================
  {
    id: '05_estados',
    nombre: '05. Diagrama de Estados de Monitoreo',
    descripcion: 'Ciclo de vida de los estados del paciente: Reposo, Monitoreo Activo, Advertencia y Emergencia Crítica SOS.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam roundcorner 10
skinparam shadowing false

skinparam state {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
}

skinparam arrow {
  Color #0284c7
  FontColor #1e293b
  FontSize 12
  Thickness 1.5
}

[*] --> EstadoReposo : Dispositivo encendido

state EstadoReposo {
  EstadoReposo : entry / Cargar configuraciones del paciente
  EstadoReposo : do / Esperar inicio de sesión
}

EstadoReposo --> MonitoreoActivo : Sesión iniciada con éxito

state MonitoreoActivo {
  MonitoreoActivo : entry / Iniciar GPS continuo y podómetro 24h
  MonitoreoActivo : do / Verificar geocerca y lectura de glucosa
  MonitoreoActivo : exit / Detener listeners de sensores
}

state EstadoAdvertencia {
  EstadoAdvertencia : entry / Emitir notificación push moderada
  EstadoAdvertencia : do / Mostrar aviso en panel y recomendar agua o colación
}

state EmergenciaCriticaSOS {
  EmergenciaCriticaSOS : entry / Disparar sirena Web Audio y vibración
  EmergenciaCriticaSOS : do / Transmitir ubicación GPS en vivo al Cuidador
  EmergenciaCriticaSOS : do / Mostrar Ficha QR PulseCard y ruta al Hospital
  EmergenciaCriticaSOS : exit / Desactivar alarma y registrar incidencia
}

MonitoreoActivo --> EstadoAdvertencia : Glucosa moderadamente alterada o Fármaco por vencer
EstadoAdvertencia --> MonitoreoActivo : Nivel estabilizado o dosis confirmada

MonitoreoActivo --> EmergenciaCriticaSOS : Glucosa extrema (<70 o >250), Salida de Geocerca o Botón SOS
EstadoAdvertencia --> EmergenciaCriticaSOS : Deterioro de parámetros clínicos

EmergenciaCriticaSOS --> MonitoreoActivo : Alarma atendida y paciente estabilizado
MonitoreoActivo --> EstadoReposo : Cerrar sesión
@enduml`
  },

  // ==========================================
  // 06. COMPONENTES (ORGANIZADO VERTICALMENTE EN 3 CAPAS)
  // ==========================================
  {
    id: '06_componentes',
    nombre: '06. Diagrama de Componentes de Arquitectura',
    descripcion: 'Estructura modular dividida en Capa de Presentación PWA, Capa de Sensores y Hardware, y Capa de Servicios Nube.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam componentStyle uml2
skinparam shadowing false
skinparam roundcorner 10

skinparam package {
  BackgroundColor #f8fafc
  BorderColor #64748b
  BorderThickness 2
  FontColor #0f172a
  FontSize 14
  FontStyle bold
}

skinparam component {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 12
  Thickness 1.5
}

package "Capa 1: Interfaz de Usuario y Lógica Cliente (DiaMon PWA)" as C1 {
  [Panel de Control & KPIs] as C_Dash
  [Motor de Alertas 24/7 & Sirena] as C_Alertas
  [Mapeo Leaflet & Geocercas Cartagena] as C_Map
  [Gestor Clínico (Glucosa y Fármacos)] as C_Clinico
  [Ficha Médica QR PulseCard] as C_QR
  [Asistente Inteligente DiaBot] as C_DiaBot

  C_Dash -[hidden]down-> C_Clinico
  C_Alertas -[hidden]down-> C_QR
  C_Map -[hidden]down-> C_DiaBot
}

package "Capa 2: APIs Nativas de Hardware del Dispositivo" as C2 {
  [Geolocation API (GPS en Vivo)] as API_GPS
  [DeviceMotionEvent (Podómetro 24h)] as API_Motion
  [Battery Status API] as API_Bat
  [Web Audio API (Generador Acústico)] as API_Audio
  [Service Worker 24/7 (sw.js)] as API_SW

  API_GPS -[hidden]down-> API_Audio
  API_Motion -[hidden]down-> API_SW
}

package "Capa 3: Servicios en la Nube & Backend Serverless" as C3 {
  [Vercel CDN Edge Network (diamon-salud.vercel.app)] as S_Vercel
  [Supabase Realtime WebSockets] as S_Realtime
  [PostgreSQL Cloud Database] as S_Postgres
  [Google Identity Services (OAuth 2.0)] as S_Google
  [Servidor de Mapas OpenStreetMap] as S_OSM

  S_Vercel -[hidden]down-> S_Google
  S_Realtime -[hidden]down-> S_OSM
}

' Forzar arquitectura en 3 capas verticales
C1 -[hidden]down-> C2
C2 -[hidden]down-> C3

' Enlaces entre Capa 1 y Capa 2
API_GPS --> C_Map : Suministra coordenadas
API_Motion --> C_Dash : Entrega conteo de pasos
API_Bat --> C_Dash : Reporta % de carga
C_Alertas --> API_Audio : Sintetiza tono de alarma
C_Alertas --> API_SW : Despacha notificaciones push

' Enlaces entre Capa 1 y Capa 3
C_Dash --> S_Vercel : Servido bajo protocolo HTTPS
C_Dash --> S_Google : Valida identidad de usuario
C_Map --> S_OSM : Descarga teselas cartográficas
C_Alertas --> S_Realtime : Difunde emergencias instantáneas
C_Clinico --> S_Postgres : Persiste tomas y mediciones
C_Alertas ..> C_QR : Activa visualización de emergencia
@enduml`
  },

  // ==========================================
  // 07. DESPLIEGUE
  // ==========================================
  {
    id: '07_despliegue',
    nombre: '07. Diagrama de Despliegue Físico y Cloud',
    descripcion: 'Distribución física en Smartphone del Paciente, Dispositivo del Cuidador, Vercel Edge y Supabase Cloud.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam shadowing false
skinparam roundcorner 10

skinparam node {
  BackgroundColor #f8fafc
  BorderColor #0284c7
  BorderThickness 2
  FontColor #0f172a
  FontSize 14
  FontStyle bold
}

skinparam component {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 12
}

skinparam database {
  BackgroundColor #f0fdf4
  BorderColor #16a34a
  BorderThickness 1.5
  FontColor #14532d
  FontSize 13
}

skinparam cloud {
  BackgroundColor #ffffff
  BorderColor #64748b
  BorderThickness 2
  FontColor #0f172a
  FontSize 14
  FontStyle bold
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 12
  Thickness 1.5
}

node "Dispositivo Móvil del Paciente (Android / iOS)" as NodoPaciente {
  node "Navegador Web (Chrome / Safari)" as NavPaciente {
    component "DiaMon SPA (HTML5/CSS3/JS)" as SPAPaciente
    database "LocalStorage & IndexedDB" as CachePaciente
    component "Service Worker 24/7 (sw.js)" as SWPaciente
  }
  node "Sensores de Hardware Móvil" as Sensores {
    [Sensor GPS GNSS] as HW_GPS
    [Acelerómetro 3D] as HW_Accel
    [Controlador Batería] as HW_Bat
  }
  Sensores --> SPAPaciente : APIs Nativas W3C
}

node "Dispositivo del Familiar / Cuidador" as NodoCuidador {
  node "Navegador Web" as NavCuidador {
    component "DiaMon Dashboard Cuidador" as SPACuidador
  }
}

cloud "Infraestructura Cloud Serverless" as CloudInfra {
  node "Vercel Edge Network" as NodoVercel {
    component "diamon-salud.vercel.app" as CDNApp
  }

  node "Supabase Cloud Ecosystem" as NodoSupabase {
    database "PostgreSQL DB\\n(Usuarios, Glucosa, Medicamentos)" as DB_Postgres
    component "Realtime WebSocket Engine" as S_Sockets
  }

  node "Google Cloud Identity" as NodoGoogle {
    component "Google OAuth 2.0 Auth Server" as GoogleAuth
  }
}

SPAPaciente -- CDNApp : HTTPS / TLS 1.3
SPACuidador -- CDNApp : HTTPS / TLS 1.3
SPAPaciente --> S_Sockets : WSS (Telemetría en Vivo)
SPACuidador --> S_Sockets : WSS (Recepción de Alertas)
SPAPaciente --> DB_Postgres : REST API / JWT
SPAPaciente --> GoogleAuth : OAuth 2.0 Consent
@enduml`
  },

  // ==========================================
  // 08. OBJETOS
  // ==========================================
  {
    id: '08_objetos',
    nombre: '08. Diagrama de Objetos en Tiempo Real',
    descripcion: 'Instancia representativa en tiempo real con datos clínicos del paciente, telemetría GPS en Cartagena y alerta activa.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam roundcorner 10
skinparam shadowing false

skinparam object {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 2
  FontColor #0f172a
  FontSize 13
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 12
  Thickness 1.5
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
  cicloPasos = "Reinicio cada 24 Horas"
  bateriaNivel = 87
}

object "alertaActiva : Alerta" as alerta {
  id = "alt-2026-0842"
  tipo = "GEOCERCA_SALIDA"
  nivelSeveridad = "ALTA"
  mensaje = "Paciente fuera de Geocerca Hogar"
  fechaHora = "2026-11-19 08:30:00"
  atendida = false
}

object "geocercaHogar : Geocerca" as geo {
  id = "geo-ctn-01"
  nombre = "Perímetro Seguro Hogar"
  latCentro = 10.4042
  lngCentro = -75.5562
  radioMetros = 300.0
  activa = true
}

object "insulinaGlargina : Medicamento" as med {
  id = "med-ins-01"
  nombre = "Insulina Glargina"
  dosis = "20 Unidades"
  horario = "08:00 AM"
  fechaVencimiento = "2027-04-15"
  tomadoHoy = true
}

object "hospitalNaval : CentroMedico" as hosp {
  nombre = "Hospital Naval de Cartagena"
  telefono = "+57 605 6500000"
  distanciaKm = 1.4
  tiempoEstimado = "4 minutos"
}

pac --> telem : genera en vivo
pac --> alerta : experimenta
pac --> geo : asignada
pac --> med : prescrito
alerta ..> hosp : solicita ruta de auxilio
@enduml`
  },

  // ==========================================
  // 09. PAQUETES
  // ==========================================
  {
    id: '09_paquetes',
    nombre: '09. Diagrama de Paquetes Modulares',
    descripcion: 'Organización de paquetes del sistema por responsabilidades: Auth, Telemetría, Monitoreo Clínico, Emergencia y Servicios.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam roundcorner 10
skinparam shadowing false

skinparam package {
  BackgroundColor #f8fafc
  BorderColor #0284c7
  BorderThickness 2
  FontColor #0f172a
  FontSize 14
  FontStyle bold
}

skinparam arrow {
  Color #0284c7
  FontColor #334155
  FontSize 12
  Thickness 1.5
}

package "com.diamon.auth (Seguridad)" as P_Auth {
  [GestorSesiones]
  [ProveedorGoogleOAuth]
  [ValidadorCodigoDM]
}

package "com.diamon.telemetria (GPS & Sensores)" as P_Telem {
  [ControladorGPSVivo]
  [Podometro24Horas]
  [MonitorBateria]
  [VerificadorGeocercas]
}

package "com.diamon.clinico (Salud & Glucosa)" as P_Clinico {
  [RegistroGlucosa]
  [ControlMedicamentos]
  [CalculadorKPIsSalud]
}

package "com.diamon.emergencia (Protocolo SOS 24/7)" as P_Emerg {
  [SirenaWebAudio]
  [GeneradorFichaQR]
  [DespachadorAlertasSOS]
  [EnrutadorHospitalesCartagena]
}

package "com.diamon.servicios (Nube & BD)" as P_Serv {
  [ClienteSupabaseRealtime]
  [AdaptadorVercelEdge]
  [RepositorioPostgreSQL]
}

' Distribución visual balanceada
P_Auth -[hidden]right-> P_Telem
P_Telem -[hidden]down-> P_Clinico
P_Auth -[hidden]down-> P_Emerg
P_Emerg -[hidden]right-> P_Serv

' Dependencias entre paquetes
P_Auth ..> P_Serv : valida credenciales
P_Telem ..> P_Serv : sincroniza GPS
P_Clinico ..> P_Serv : persiste lecturas
P_Emerg ..> P_Telem : consulta posición
P_Emerg ..> P_Clinico : lee ficha médica
P_Emerg ..> P_Serv : difunde alarma
@enduml`
  },

  // ==========================================
  // 10. COMUNICACIÓN (COLABORACIÓN SOS)
  // ==========================================
  {
    id: '10_comunicacion',
    nombre: '10. Diagrama de Comunicación / Colaboración SOS',
    descripcion: 'Mensajería numerada de colaboración entre objetos durante la activación de una emergencia médica 24/7.',
    source: `@startuml
skinparam backgroundColor #ffffff
skinparam defaultFontName Arial
skinparam defaultFontSize 13
skinparam roundcorner 8
skinparam shadowing false

skinparam actor {
  BackgroundColor #f0f9ff
  BorderColor #0284c7
  BorderThickness 2
  FontColor #0f172a
  FontSize 14
  FontStyle bold
}

skinparam rectangle {
  BackgroundColor #ffffff
  BorderColor #0284c7
  BorderThickness 1.5
  FontColor #0f172a
  FontSize 13
}

skinparam arrow {
  Color #0284c7
  FontColor #0f172a
  FontSize 12
  Thickness 1.5
}

actor "Paciente : Paciente" as Paciente
rectangle ":DiaMonApp" as App
rectangle ":SensorGPS" as GPS
rectangle ":MotorAlertas" as Alertas
rectangle "<color:#ffffff><b>:SOSDispatcher</b></color>" as SOS #dc2626
rectangle ":CentroHospitalario" as Hosp #0369a1
actor "Familiar : Cuidador" as Familiar

Paciente -- App : 1: presionaBotonSOS()\\n7: visualizaRutaYFichaQR()
App -- GPS : 2: capturarCoordenadasVivo()
App -- Alertas : 3: activarEmergencia(lat, lng)
Alertas -- SOS : 4: propagarAlertaCritica()
SOS -- Familiar : 5: emitirPushNotification24_7()
SOS -- Hosp : 6: transmitirTelemetriaYFicha()
@enduml`
  }
];

async function main() {
  console.log('=== Generando 10 Diagramas UML Oficiales en Ultra-HD (Alta Definición) ===');

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

      // Generar PNG en ALTA DEFINICIÓN usando resvg con zoom 2x y DPI 300 para legibilidad perfecta
      execSync(`npx -y @resvg/resvg-js-cli --fit-zoom 2.0 --dpi 300 --background "#ffffff" "${svgPath}" "${pngPath}"`, { stdio: 'inherit' });
      console.log(`  ✓ PNG Ultra-HD generado: ${pngPath}`);
    } catch (err) {
      console.error(`  ✗ Error en ${item.id}:`, err.message);
    }
  }

  // Generar galería HTML profesional con visor Lightbox Modal (Zoom y Navegación)
  const htmlGaleria = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DiaMon — Colección Oficial de Diagramas UML (Ultra-HD)</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --bg-page: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      padding: 36px 24px;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      max-width: 960px;
      margin: 0 auto 36px;
    }
    .header h1 {
      font-size: 30px;
      font-weight: 800;
      color: var(--primary-dark);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .header p {
      font-size: 15px;
      color: var(--text-muted);
      max-width: 820px;
      margin: 0 auto 16px;
    }
    .badge-bar {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #e0f2fe;
      color: var(--primary-dark);
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(2, 132, 199, 0.12);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
      gap: 28px;
      max-width: 1440px;
      margin: 0 auto;
    }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
    }
    .card-header {
      padding: 18px 22px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #fafcff;
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }
    .card-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      padding: 6px 11px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #334155;
      transition: background 0.15s;
    }
    .btn-action:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-action.puml {
      background: #eff6ff;
      color: #1d4ed8;
    }
    .btn-action.zoom {
      background: #0284c7;
      color: #ffffff;
      cursor: pointer;
      border: none;
    }
    .btn-action.zoom:hover {
      background: #0369a1;
    }
    .card-desc {
      padding: 12px 22px 4px;
      font-size: 13.5px;
      color: var(--text-muted);
    }
    .card-img-wrap {
      padding: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      flex: 1;
      min-height: 320px;
      cursor: pointer;
      position: relative;
    }
    .card-img-wrap img {
      max-width: 100%;
      max-height: 400px;
      object-fit: contain;
      border-radius: 8px;
      border: 1px solid #eef2f6;
      transition: opacity 0.2s;
    }
    .card-img-wrap:hover img {
      opacity: 0.95;
    }
    .zoom-hint {
      position: absolute;
      bottom: 24px;
      right: 24px;
      background: rgba(15, 23, 42, 0.75);
      color: #ffffff;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* LIGHTBOX MODAL */
    .lightbox {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(4px);
      z-index: 99999;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox-content {
      position: relative;
      max-width: 95vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .lightbox-img {
      max-width: 95vw;
      max-height: 82vh;
      object-fit: contain;
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      padding: 12px;
    }
    .lightbox-title {
      color: #ffffff;
      font-size: 17px;
      font-weight: 700;
      margin-top: 12px;
      text-align: center;
    }
    .lightbox-close {
      position: absolute;
      top: -42px;
      right: 0;
      background: #ffffff;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0f172a;
    }
    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255,255,255,0.25);
      color: #ffffff;
      border: none;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .lightbox-nav:hover {
      background: rgba(255,255,255,0.45);
    }
    .lightbox-prev { left: 20px; }
    .lightbox-next { right: 20px; }

    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1><i class="fas fa-project-diagram"></i> DiaMon — Diagramas UML del Sistema</h1>
    <p>Modelado formal del software de Monitoreo Inteligente de Diabetes & Salud GPS en Cartagena. Tipografía en Arial de alta legibilidad, resolución Ultra-HD (300 DPI), corrección de contraste y adaptación para visualización perfecta.</p>
    <div class="badge-bar"><i class="fas fa-check-circle"></i> 10 Diagramas UML 2.5 Oficiales — Calidad de Exposición & Impresión</div>
  </div>

  <div class="grid">
    ${DIAGRAMAS.map((d, index) => `
      <div class="card" id="card-${d.id}">
        <div class="card-header">
          <div class="card-title">${d.nombre}</div>
          <div class="card-actions">
            <button class="btn-action zoom" onclick="openLightbox(${index})"><i class="fas fa-expand"></i> Ver Grande</button>
            <a href="${d.id}.png" target="_blank" download class="btn-action"><i class="fas fa-download"></i> PNG HD</a>
            <a href="${d.id}.svg" target="_blank" class="btn-action"><i class="fas fa-vector-square"></i> SVG</a>
            <a href="puml_sources/${d.id}.puml" target="_blank" class="btn-action puml"><i class="fas fa-code"></i> PUML</a>
          </div>
        </div>
        <div class="card-desc">${d.descripcion}</div>
        <div class="card-img-wrap" onclick="openLightbox(${index})">
          <img src="${d.id}.png" alt="${d.nombre}" loading="lazy">
          <div class="zoom-hint"><i class="fas fa-search-plus"></i> Clic para pantalla completa</div>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- LIGHTBOX PARA VER TODOS LOS DETALLES NÍTIDOS -->
  <div class="lightbox" id="lightboxModal" onclick="closeLightbox(event)">
    <div class="lightbox-content" onclick="event.stopPropagation()">
      <button class="lightbox-close" onclick="closeLightbox(null)"><i class="fas fa-times"></i></button>
      <img id="lightboxImg" class="lightbox-img" src="" alt="">
      <div id="lightboxTitle" class="lightbox-title"></div>
    </div>
    <button class="lightbox-nav lightbox-prev" onclick="navLightbox(-1, event)"><i class="fas fa-chevron-left"></i></button>
    <button class="lightbox-nav lightbox-next" onclick="navLightbox(1, event)"><i class="fas fa-chevron-right"></i></button>
  </div>

  <script>
    const diagramasData = ${JSON.stringify(DIAGRAMAS.map(d => ({ id: d.id, nombre: d.nombre })))};
    let currentIndex = 0;

    function openLightbox(index) {
      currentIndex = index;
      const d = diagramasData[index];
      document.getElementById('lightboxImg').src = d.id + '.png';
      document.getElementById('lightboxTitle').textContent = d.nombre;
      document.getElementById('lightboxModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox(event) {
      document.getElementById('lightboxModal').classList.remove('active');
      document.body.style.overflow = 'auto';
    }

    function navLightbox(direction, event) {
      if (event) event.stopPropagation();
      currentIndex = (currentIndex + direction + diagramasData.length) % diagramasData.length;
      openLightbox(currentIndex);
    }

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('lightboxModal').classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navLightbox(-1);
      if (e.key === 'ArrowRight') navLightbox(1);
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index_galeria_diagramas.html'), htmlGaleria, 'utf8');
  console.log('\n✓ index_galeria_diagramas.html actualizado con visor interactivo Lightbox.');
  console.log('\n=== Proceso completado exitosamente ===');
}

main().catch(console.error);
