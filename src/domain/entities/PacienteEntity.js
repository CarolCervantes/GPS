// Dominio: Entidad Paciente (Damián Díaz Balseiro - Barrio Chapacuá)
// Arquitectura Hexagonal - Capa de Dominio (Sin dependencias externas)

(function (root) {
  'use strict';

  class PacienteEntity {
    constructor(props = {}) {
      this.id = props.id || 'pac-damian-diaz-01';
      this.codigoPaciente = props.codigoPaciente || 'DM-8492';
      this.nombre = props.nombre || 'Damián Díaz Balseiro';
      this.edad = Number(props.edad) || 74;
      this.barrioResidencia = props.barrioResidencia || 'Barrio Chapacuá, Cartagena de Indias';
      this.coordenadasCasa = props.coordenadasCasa || { lat: 10.39991, lng: -75.47886 };
      this.radioSeguroMetros = Number(props.radioSeguroMetros) || 400;
      this.profesionalGuia = props.profesionalGuia || 'Enf. Jefe Elizabeth Vargas Caro';
      this.cuidadorPrincipal = props.cuidadorPrincipal || 'Valentina Díaz Martínez';
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PacienteEntity };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.PacienteEntity = PacienteEntity;
})(typeof window !== 'undefined' ? window : globalThis);
