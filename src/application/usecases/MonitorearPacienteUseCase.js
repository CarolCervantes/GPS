// Caso de uso para validar la ubicacion del paciente y guardarla en el repositorio
(function (root) {
  'use strict';

  const DomainService = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/services/EvaluadorClinicoDomainService').EvaluadorClinicoDomainService
    : root.DiaMonHexagonal?.EvaluadorClinicoDomainService;

  class MonitorearPacienteUseCase {
    constructor(repositoryAdapter) {
      this.repository = repositoryAdapter;
    }

    async procesarUbicacionGPS(lat, lng, paciente) {
      const resultado = DomainService.verificarGeocerca(
        lat,
        lng,
        paciente.coordenadasCasa.lat,
        paciente.coordenadasCasa.lng,
        paciente.radioSeguroMetros
      );
      if (this.repository && typeof this.repository.guardarPosicionGPS === 'function') {
        await this.repository.guardarPosicionGPS({ lat, lng, ...resultado });
      }
      return resultado;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MonitorearPacienteUseCase };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.MonitorearPacienteUseCase = MonitorearPacienteUseCase;
})(typeof window !== 'undefined' ? window : globalThis);
