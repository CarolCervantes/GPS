const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Renderiza código PlantUML a archivo SVG usando el motor oficial @plantuml/mcp-js
 * @param {string} source Código PlantUML (@startuml ... @enduml)
 * @param {string} outputPath Ruta del archivo SVG resultante
 */
function renderUml(source, outputPath) {
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
            // Inicializado -> Llamar a render_diagram
            const renderReq = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'render_diagram',
                arguments: { source: source.trim() }
              }
            };
            child.stdin.write(JSON.stringify(renderReq) + '\n');
          } else if (msg.id === 2) {
            // Resultado
            child.kill();
            if (msg.result && msg.result.content) {
              const textContent = msg.result.content[0]?.text;
              const parsed = JSON.parse(textContent);
              if (parsed.valid && parsed.svg) {
                if (outputPath) {
                  fs.writeFileSync(outputPath, parsed.svg, 'utf8');
                  console.log(`Diagrama generado con éxito en: ${outputPath}`);
                }
                resolve(parsed.svg);
              } else {
                reject(new Error(parsed.errorMessage || 'Error de sintaxis en PlantUML'));
              }
            } else if (msg.error) {
              reject(new Error(msg.error.message));
            }
          }
        } catch (_) {}
      }
    });

    child.on('error', reject);

    const initReq = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'diamon-uml-runner', version: '1.0' }
      }
    };

    child.stdin.write(JSON.stringify(initReq) + '\n');
  });
}

// Ejemplo de prueba: Diagrama de clases de DiaMon
const testUml = `
@startuml
skinparam backgroundColor #0a1832
skinparam handwritten false
skinparam defaultFontName "Helvetica"
skinparam defaultFontColor #ffffff

class Usuario {
  +id: String
  +nombre: String
  +email: String
  +codigoPaciente: String
  +iniciarSesion()
  +crearCuenta()
}

class Administrador {
  +id: String
  +nombre: String
  +vincularConPaciente(codigo: String)
}

class Telemetria {
  +glucosa: Number
  +bateria: Number
  +pasos: Number
  +latitud: Number
  +longitud: Number
  +obtenerEnTiempoReal()
}

class Medicamento {
  +id: String
  +nombre: String
  +dosis: String
  +horario: String
  +estado: String
}

Usuario "1" *-- "1" Telemetria : monitorea
Usuario "1" *-- "many" Medicamento : tiene asignados
Administrador "1" ..> "1" Usuario : supervisa por codigoPaciente

@enduml
`;

const outPath = path.join(__dirname, 'diamon_architecture_uml.svg');
renderUml(testUml, outPath).then(() => {
  console.log('Test finalizado correctamente.');
}).catch((err) => {
  console.error('Error renderizando UML:', err);
});
