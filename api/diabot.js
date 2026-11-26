// Endpoint Serverless para DiaBot con IA Real (Google Gemini API)
// Compatible con Vercel Serverless Functions (/api/diabot) y con server.js local.
// Recibe:
// - message: Pregunta del paciente o cuidador
// - context: Estado clínico en tiempo real del Caso de Estudio (Glucosa, Presión, Medicación, Ubicación)
const SYSTEM_PROMPT_CLINICO = `Eres DiaBot, el asistente clínico inteligente del sistema DiaMon (Monitoreo GPS y Telemetría para pacientes con Diabetes Mellitus e Hipertensión Arterial en Cartagena de Indias, Colombia).
El sistema está aplicado al Caso de Estudio real del Sr. Damián Díaz Balseiro (residente en el barrio Chapacuá, Cartagena de Indias), con Diabetes Mellitus Tipo 2 insulinorrequiriente, Hipertensión Arterial y Neuropatía Diabética, bajo la guía clínica de la Enfermera Jefe Elizabeth Vargas Caro.

ESQUEMA FARMACOLÓGICO OFICIAL DE DAMIÁN DÍAZ BALSEIRO:
- 08:00 AM: Pantoprazol (protector gástrico), Metformina (diabetes), Firialta / Finerenona (protección renal y cardiovascular en diabetes) y Nifedipino (hipertensión arterial).
- 02:00 PM: Valsartán (control vespertino de hipertensión arterial).
- 08:00 PM: Atorvastatina (colesterol/protección vascular), Metformina (diabetes), Gabapentina + Lipotic / Ácido Tióctico (manejo de neuropatía diabética periférica) y Nifedipino (hipertensión nocturna).
- 09:00 PM: Insulina Basal - 24 Unidades subcutáneas.
- Sábados: Ozempic (Semaglutida semanal).

REGLAS CLÍNICAS Y DE SEGURIDAD OBLIGATORIAS:
1. Analiza siempre el CONTEXTO EN TIEMPO REAL de Damián Díaz Balseiro que recibes (su última glucosa en mg/dL, su última presión arterial en mmHg, su pulso, sus metas clínicas pautadas con la Enf. Jefe Elizabeth Vargas Caro y su ubicación GPS en el barrio Chapacuá).
2. Si la glucosa es menor a 80 mg/dL (hipoglucemia en paciente que usa 24 UI de insulina y Metformina), indica con urgencia aplicar la Regla 15-15 (15g de carbohidratos rápidos como medio vaso de jugo o agua con azúcar, esperar 15 min sentado y volver a medir) y notificar a su familia en Chapacuá.
3. Si la presión arterial supera 140/90 mmHg (o crisis >= 160/100 mmHg), recomienda reposo sentado inmediato, verificar si ya tomó su Nifedipino (8 AM / 8 PM) o su Valsartán (2 PM), y contactar al médico o línea 123 / CRUE si hay cefalea, dolor torácico o visión borrosa.
4. NUNCA recetes medicamentos nuevos ni modifiques las dosis prescritas.
5. Responde en español claro, empático y estructurado con viñetas breves. Máximo 140 palabras.`;

module.exports = async function handler(req, res) {
  // Cors
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Método no permitido. Usa POST.' }));
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const userMessage = (body.message || '').trim().slice(0, 600);
    const clinicalContext = body.context || {};
    // SEGURIDAD: La clave de Gemini se lee exclusivamente de variables de entorno del servidor
    const apiKey = process.env.GEMINI_API_KEY || '';

    if (!userMessage) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Mensaje vacío.' }));
      return;
    }

    const resumenContexto = `
CONTEXTO CLÍNICO ACTUAL DEL PACIENTE (EN VIVO):
- Paciente: ${clinicalContext.nombre || 'Damián Díaz Balseiro'}
- Diagnóstico: ${clinicalContext.diagnostico || 'Diabetes Mellitus Tipo 2 Insulinorrequiriente + Hipertensión Arterial + Neuropatía Diabética'}
- Última Glucosa Capilar: ${clinicalContext.glucosa || '114 mg/dL'} (${clinicalContext.contextoGlucosa || 'En ayunas'}) -> Estado: ${clinicalContext.estadoGlucosa || 'En meta clínica'}
- Última Presión Arterial: ${clinicalContext.presion || '126/78 mmHg'} (Pulso: ${clinicalContext.pulso || '71 BPM'}) -> Estado: ${clinicalContext.estadoPresion || 'Controlada'}
- Metas pautadas con ${clinicalContext.profesional || 'Enf. Jefe Elizabeth Vargas Caro'}: Glucosa ${clinicalContext.metaGlucosa || 'en ayunas 80-135 mg/dL y después de comer < 180 mg/dL'}, Presión < ${clinicalContext.metaPresion || '140/90 mmHg'}
- Esquema farmacológico: 8AM (Pantoprazol, Metformina, Firialta, Nifedipino) | 2PM (Valsartán) | 8PM (Atorvastatina, Metformina, Gabapentina, Lipotic, Nifedipino) | 9PM (Insulina 24 UI) | Sábados (Ozempic)
- Ubicación GPS actual: ${clinicalContext.ubicacion || 'Barrio Chapacuá, Cartagena de Indias'}
`.trim();

    // Si hay clave de Anthropic se usa Claude; si no, Gemini; si no hay ninguna, responde el motor local
    const claveClaude = process.env.ANTHROPIC_API_KEY || '';
    if (claveClaude) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claveClaude,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
          max_tokens: 450,
          system: SYSTEM_PROMPT_CLINICO + '\n\n' + resumenContexto,
          messages: [{ role: 'user', content: userMessage }]
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const texto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        if (texto) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ reply: texto, engine: data.model || 'claude', usedLiveContext: true }));
          return;
        }
      } else {
        console.warn('DiaBot: Claude respondio', resp.status);
      }
    }

    if (apiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const geminiResp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT_CLINICO + '\n\n' + resumenContexto }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userMessage }]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 450
          }
        })
      });

      if (geminiResp.ok) {
        const data = await geminiResp.json();
        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            reply: aiText,
            engine: 'gemini-2.5-flash',
            usedLiveContext: true
          }));
          return;
        }
      }
    }

    // Si no hay GEMINI_API_KEY en el entorno, el servidor devuelve señal para que el motor
    // clínico contextual integrado responda usando los signos vitales reales del paciente.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      reply: null,
      engine: 'clinical-context-engine',
      usedLiveContext: true
    }));
  } catch (err) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      reply: null,
      engine: 'clinical-context-engine',
      error: err.message
    }));
  }
};

