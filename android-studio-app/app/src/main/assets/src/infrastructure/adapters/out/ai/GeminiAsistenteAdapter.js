// Infraestructura - Adaptador de Salida: Google Gemini API para DiaBot
// Implementa AsistenteIAPort

'use strict';

const { AsistenteIAPort } = require('../../../../domain/ports/AsistenteIAPort');

class GeminiAsistenteAdapter extends AsistenteIAPort {
  constructor({
    apiKey = undefined,
    model = 'gemini-2.5-flash',
    fetchImpl = (typeof fetch === 'function' ? fetch : null)
  } = {}) {
    super();
    this._explicitApiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  _getApiKey() {
    if (this._explicitApiKey !== undefined) {
      return String(this._explicitApiKey || '').trim();
    }
    return String(process.env.GEMINI_API_KEY || '').trim();
  }

  estaConfigurado() {
    return Boolean(this._getApiKey() && this.fetchImpl);
  }

  async generarRespuesta(consulta, instruccionSistema) {
    const apiKey = this._getApiKey();
    if (!apiKey || !this.fetchImpl) {
      return null;
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const geminiResp = await this.fetchImpl(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instruccionSistema }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: consulta.message }]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 450
          }
        }),
        signal: controller.signal
      });

      if (!geminiResp.ok) {
        return null;
      }

      const data = await geminiResp.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      if (!aiText) return null;

      return {
        reply: aiText,
        engine: this.model
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { GeminiAsistenteAdapter };
