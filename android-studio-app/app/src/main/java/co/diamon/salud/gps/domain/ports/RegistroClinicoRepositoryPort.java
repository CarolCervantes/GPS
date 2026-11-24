package co.diamon.salud.gps.domain.ports;

import co.diamon.salud.gps.domain.entities.RegistroClinico;

// Arquitectura Hexagonal - Puerto de Salida (Repositorio)
public interface RegistroClinicoRepositoryPort {
    void agregarRegistro(RegistroClinico reg) throws Exception;
    RegistroClinico consultarUnRegistro(String id) throws Exception;
    void editarRegistro(RegistroClinico reg) throws Exception;
    void borrarRegistro(String id) throws Exception;
    int proximoId();
}
