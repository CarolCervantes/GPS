// Adaptador de salida: DiaBot con Claude (API de Anthropic).
const { AsistenteIAPort } = require('../../../../domain/ports/AsistenteIAPort');

class ClaudeAsistenteAdapter extends AsistenteIAPort {
  constructor(clave, modelo = 'claude-haiku-5-5') {
    super();
    this.clave = clave || '';
    this.modelo = modelo;
    this.nombre = 'claude';
  }

  disponible() {
    return this.clave.length > 0;
  }

  async responder(instrucciones, mensaje) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.modelo,
        max_tokens: 450,
        system: instrucciones,
        messages: [{ role: 'user', content: mensaje }]
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const texto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return texto || null;
  }
}

module.exports = { ClaudeAsistenteAdapter };
