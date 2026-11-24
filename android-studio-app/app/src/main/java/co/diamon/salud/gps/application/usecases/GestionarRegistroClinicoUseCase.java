package co.diamon.salud.gps.application.usecases;

import co.diamon.salud.gps.domain.entities.RegistroClinico;
import co.diamon.salud.gps.domain.ports.RegistroClinicoRepositoryPort;

// Arquitectura Hexagonal - Capa de Aplicacion (Caso de Uso CRUD Clinico + Sincronizacion Supabase)
public class GestionarRegistroClinicoUseCase {

    private final RegistroClinicoRepositoryPort sqliteRepository;
    private final RegistroClinicoRepositoryPort supabaseRepository;

    public GestionarRegistroClinicoUseCase(RegistroClinicoRepositoryPort sqliteRepository, RegistroClinicoRepositoryPort supabaseRepository) {
        this.sqliteRepository = sqliteRepository;
        this.supabaseRepository = supabaseRepository;
    }

    public void guardar(RegistroClinico reg) throws Exception {
        sqliteRepository.agregarRegistro(reg);
        if (supabaseRepository != null) {
            try {
                supabaseRepository.agregarRegistro(reg);
            } catch (Exception ignored) {
            }
        }
    }

    public RegistroClinico buscarPorId(String id) throws Exception {
        return sqliteRepository.consultarUnRegistro(id);
    }

    public void modificar(RegistroClinico reg) throws Exception {
        sqliteRepository.editarRegistro(reg);
        if (supabaseRepository != null) {
            try {
                supabaseRepository.editarRegistro(reg);
            } catch (Exception ignored) {
            }
        }
    }

    public void eliminar(String id) throws Exception {
        sqliteRepository.borrarRegistro(id);
        if (supabaseRepository != null) {
            try {
                supabaseRepository.borrarRegistro(id);
            } catch (Exception ignored) {
            }
        }
    }

    public int obtenerProximoId() {
        return sqliteRepository.proximoId();
    }
}
