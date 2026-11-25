// Infraestructura: Adaptador Web Bluetooth (BLE GATT) para Reloj Inteligente, Anillo o Banda
// Soporta perfiles estándar Bluetooth SIG:
//   - Heart Rate Service (0x180D) -> Characteristic 0x2A37
//   - Health Thermometer Service (0x1809) -> Characteristic 0x2A1C (IEEE-11073 FLOAT)
//   - Battery Service (0x180F) -> Characteristic 0x2A19
// Arquitectura Hexagonal - Driving/Driven Hardware Adapter (Implementa WearableSensorPort)

(function (root) {
  'use strict';

  const UUIDS = {
    HEART_RATE_SERVICE: 'heart_rate',                 // 0x180D
    HEART_RATE_MEASUREMENT: 'heart_rate_measurement', // 0x2A37
    THERMOMETER_SERVICE: 'health_thermometer',        // 0x1809
    TEMPERATURE_MEASUREMENT: 'temperature_measurement', // 0x2A1C
    BATTERY_SERVICE: 'battery_service',               // 0x180F
    BATTERY_LEVEL: 'battery_level'                    // 0x2A19
  };

  class WebBluetoothWearableAdapter {
    constructor() {
      this.device = null;
      this.server = null;
      this.conectado = false;
      this.soportaRitmoCardiaco = false;
      this.soportaTemperatura = false;
      this.bateria = null;
      this.ultimoBpm = null;
      this.ultimaTempC = null;
      this.dispositivoTipo = 'reloj_inteligente';
      this.callbacks = [];
      this.onDisconnectCallbacks = [];
    }

    static esCompatible() {
      return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth && navigator.bluetooth.requestDevice);
    }

    // Decodificador estándar Bluetooth SIG 0x2A37 (Heart Rate Measurement)
    static parseHeartRateMeasurement(dataView) {
      if (!dataView || dataView.byteLength < 2) return null;
      const flags = dataView.getUint8(0);
      const isUint16 = (flags & 0x01) !== 0;
      const bpm = isUint16 && dataView.byteLength >= 3
        ? dataView.getUint16(1, true)
        : dataView.getUint8(1);
      return bpm > 0 && bpm < 250 ? bpm : null;
    }

    // Decodificador estándar Bluetooth SIG 0x2A1C (Health Thermometer IEEE-11073 32-bit FLOAT)
    static parseHealthThermometerMeasurement(dataView) {
      if (!dataView || dataView.byteLength < 5) return null;
      const flags = dataView.getUint8(0);
      const isFahrenheit = (flags & 0x01) !== 0;

      const raw = dataView.getUint32(1, true);
      let mantissa = raw & 0x00FFFFFF;
      if (mantissa >= 0x800000) mantissa -= 0x1000000; // complemento a 2 (24-bit signed)
      let exponent = (raw >> 24) & 0xFF;
      if (exponent >= 0x80) exponent -= 0x100; // complemento a 2 (8-bit signed)

      let valor = mantissa * Math.pow(10, exponent);
      if (isFahrenheit) {
        valor = (valor - 32) * (5 / 9);
      }

      if (isNaN(valor) || valor < 30 || valor > 44) return null;
      return Number(valor.toFixed(1));
    }

    suscribirLecturas(callback) {
      if (typeof callback === 'function') {
        this.callbacks.push(callback);
      }
    }

    suscribirDesconexion(callback) {
      if (typeof callback === 'function') {
        this.onDisconnectCallbacks.push(callback);
      }
    }

    emitirLectura() {
      if (this.ultimoBpm === null) return;
      const payload = {
        ritmoCardiacoBpm: this.ultimoBpm,
        temperaturaC: this.ultimaTempC,
        dispositivoTipo: this.dispositivoTipo,
        dispositivoNombre: this.device?.name || 'Wearable Bluetooth BLE',
        fuente: 'ble_real',
        bateriaDispositivo: this.bateria,
        ts: Date.now()
      };
      this.callbacks.forEach(cb => {
        try { cb(payload); } catch (_) {}
      });
    }

    async conectar(opciones = {}) {
      if (!WebBluetoothWearableAdapter.esCompatible()) {
        throw new Error(
          'Web Bluetooth no está disponible en este navegador. Usa Chrome/Edge en Android o escritorio (HTTPS/localhost) o conecta mediante el puente nativo de la App Android.'
        );
      }

      this.dispositivoTipo = opciones.dispositivoTipo || 'reloj_inteligente';

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [UUIDS.HEART_RATE_SERVICE] },
          { services: [UUIDS.THERMOMETER_SERVICE] }
        ],
        optionalServices: [
          UUIDS.HEART_RATE_SERVICE,
          UUIDS.THERMOMETER_SERVICE,
          UUIDS.BATTERY_SERVICE
        ]
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', () => {
        this.conectado = false;
        this.onDisconnectCallbacks.forEach(cb => {
          try { cb(this.obtenerMetadataDispositivo()); } catch (_) {}
        });
      });

      this.server = await device.gatt.connect();
      this.conectado = true;

      // 1. Servicio de Ritmo Cardíaco (0x180D)
      try {
        const hrService = await this.server.getPrimaryService(UUIDS.HEART_RATE_SERVICE);
        const hrChar = await hrService.getCharacteristic(UUIDS.HEART_RATE_MEASUREMENT);
        await hrChar.startNotifications();
        this.soportaRitmoCardiaco = true;

        hrChar.addEventListener('characteristicvaluechanged', (event) => {
          const bpm = WebBluetoothWearableAdapter.parseHeartRateMeasurement(event.target.value);
          if (bpm !== null) {
            this.ultimoBpm = bpm;
            this.emitirLectura();
          }
        });
      } catch (_) {
        this.soportaRitmoCardiaco = false;
      }

      // 2. Servicio de Termómetro de Salud (0x1809) — opcional (algunos relojes/anillos lo exponen)
      try {
        const tempService = await this.server.getPrimaryService(UUIDS.THERMOMETER_SERVICE);
        const tempChar = await tempService.getCharacteristic(UUIDS.TEMPERATURE_MEASUREMENT);
        await tempChar.startNotifications();
        this.soportaTemperatura = true;

        tempChar.addEventListener('characteristicvaluechanged', (event) => {
          const tempC = WebBluetoothWearableAdapter.parseHealthThermometerMeasurement(event.target.value);
          if (tempC !== null) {
            this.ultimaTempC = tempC;
            if (this.ultimoBpm !== null) {
              this.emitirLectura();
            }
          }
        });
      } catch (_) {
        this.soportaTemperatura = false;
      }

      // 3. Nivel de Batería del Wearable (0x180F) — opcional
      try {
        const batService = await this.server.getPrimaryService(UUIDS.BATTERY_SERVICE);
        const batChar = await batService.getCharacteristic(UUIDS.BATTERY_LEVEL);
        const val = await batChar.readValue();
        this.bateria = val.getUint8(0);
      } catch (_) {
        this.bateria = null;
      }

      return this.obtenerMetadataDispositivo();
    }

    async desconectar() {
      this.conectado = false;
      try {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
          this.device.gatt.disconnect();
        }
      } catch (_) {}
      this.device = null;
      this.server = null;
      this.soportaRitmoCardiaco = false;
      this.soportaTemperatura = false;
      this.bateria = null;
    }

    estaConectado() {
      return Boolean(this.conectado && this.device?.gatt?.connected);
    }

    obtenerMetadataDispositivo() {
      return {
        conectado: this.estaConectado(),
        nombre: this.device?.name || 'Sin dispositivo BLE',
        tipo: this.dispositivoTipo,
        soportaRitmoCardiaco: this.soportaRitmoCardiaco,
        soportaTemperatura: this.soportaTemperatura,
        bateria: this.bateria
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebBluetoothWearableAdapter, UUIDS };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.WebBluetoothWearableAdapter = WebBluetoothWearableAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
