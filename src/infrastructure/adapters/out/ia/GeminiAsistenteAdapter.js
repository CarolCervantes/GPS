// Adaptador de salida: DiaBot con Gemini (API de Google).
const { AsistenteIAPort } = require('../../../../domain/ports/AsistenteIAPort');

class GeminiAsistenteAdapter extends AsistenteIAPort {
  constructor(clave, modelo = 'gemini-2.5-flash') {
    super();
    this.clave = clave || '';
    this.modelo = modelo;
    this.nombre = 'gemini';
  }

  disponible() {
    return this.clave.length > 0;
  }

  async responder(instrucciones, mensaje) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent?key=${encodeURIComponent(this.clave)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucciones }] },
        contents: [{ role: 'user', parts: [{ text: mensaje }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 450 }
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }
}

module.exports = { GeminiAsistenteAdapter };
