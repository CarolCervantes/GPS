// Adaptador de salida: DiaBot con Gemini (API de Google).
const { AsistenteIAPort } = require('../../../../domain/ports/AsistenteIAPort');

// Si el modelo principal esta saturado se prueba con estos (los "latest" los mantiene Google)
const MODELOS_RESPALDO = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

class GeminiAsistenteAdapter extends AsistenteIAPort {
  constructor(clave, modelo) {
    super();
    this.clave = clave || '';
    this.modelo = modelo || 'gemini-3.8-flash';
    this.nombre = 'gemini';
  }

  disponible() {
    return this.clave.length > 0;
  }

  async responder(instrucciones, mensaje) {
    const modelos = [this.modelo, ...MODELOS_RESPALDO.filter(m => m !== this.modelo)];
    for (const modelo of modelos) {
      const texto = await this.pedir(modelo, instrucciones, mensaje);
      if (texto) return texto;
    }
    return null;
  }

  async pedir(modelo, instrucciones, mensaje, sinPensar = true) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(this.clave)}`;
    let resp;
    try {
      resp = await fetch(url, {
      method: 'POST',
      // maximo 9 segundos por intento, para que DiaBot no se quede pegado
      signal: AbortSignal.timeout(9000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucciones }] },
        contents: [{ role: 'user', parts: [{ text: mensaje }] }],
        // thinkingBudget 0: si no, el modelo gasta los tokens "pensando" y no devuelve texto
        generationConfig: sinPensar
          ? { temperature: 0.35, maxOutputTokens: 450, thinkingConfig: { thinkingBudget: 0 } }
          : { temperature: 0.35, maxOutputTokens: 1200 }
      })
      });
    } catch (err) {
      console.error('Gemini', modelo, 'no respondio a tiempo:', err.name);
      return null;
    }
    // algunos modelos no aceptan apagar el "pensamiento": se intenta otra vez sin eso
    if (resp.status === 400 && sinPensar) return this.pedir(modelo, instrucciones, mensaje, false);
    if (!resp.ok) {
      // se ve en los logs de Vercel, sin mostrar la clave
      console.error('Gemini', modelo, 'respondio', resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const partes = data?.candidates?.[0]?.content?.parts || [];
    const texto = partes.map(p => p.text || '').join('').trim();
    if (!texto) console.error('Gemini', modelo, 'sin texto:', data?.candidates?.[0]?.finishReason);
    return texto || null;
  }
}

module.exports = { GeminiAsistenteAdapter };
