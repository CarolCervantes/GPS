// Dominio: Puerto de Entrada para Dispositivos Wearables (Reloj Inteligente, Anillo, Banda BLE)
// Arquitectura Hexagonal - Ports
// Permite conectar luego cualquier reloj inteligente (Web Bluetooth, Wear OS, Health Connect, API)
// sin modificar las reglas clínicas ni el motor de alertas.

(function (root) {
  'use strict';

  class WearableSensorPort {
    async conectar(_opciones = {}) {
      throw new Error('WearableSensorPort.conectar() not implemented');
    }

    async desconectar() {
      throw new Error('WearableSensorPort.desconectar() not implemented');
    }

    estaConectado() {
      return false;
    }

    obtenerMetadataDispositivo() {
      return {
        conectado: false,
        nombre: 'Sin dispositivo conectado',
        tipo: 'reloj_inteligente',
        soportaRitmoCardiaco: false,
        soportaTemperatura: false,
        bateria: null
      };
    }

    suscribirLecturas(_callback) {
      throw new Error('WearableSensorPort.suscribirLecturas() not implemented');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WearableSensorPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.WearableSensorPort = WearableSensorPort;
})(typeof window !== 'undefined' ? window : globalThis);
