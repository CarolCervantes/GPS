package co.diamon.salud.gps.infrastructure.adapters.sqlite;

import android.content.Context;

import co.diamon.salud.gps.dao.DaoRegistroClinico;
import co.diamon.salud.gps.domain.entities.RegistroClinico;
import co.diamon.salud.gps.domain.ports.RegistroClinicoRepositoryPort;

/**
 * Arquitectura Hexagonal - Adaptador de Salida SQLite Offline
 * Implementa RegistroClinicoRepositoryPort delegando al motor SQLite local.
 */
public class SqliteRegistroClinicoAdapter implements RegistroClinicoRepositoryPort {

    private final DaoRegistroClinico dao;

    public SqliteRegistroClinicoAdapter(Context context, String dbName, int version) throws Exception {
        this.dao = new DaoRegistroClinico(context, dbName, version);
    }

    @Override
    public void agregarRegistro(RegistroClinico reg) throws Exception {
        dao.agregarRegistro(reg);
    }

    @Override
    public RegistroClinico consultarUnRegistro(String id) throws Exception {
        return dao.consultarUnRegistro(id);
    }

    @Override
    public void editarRegistro(RegistroClinico reg) throws Exception {
        dao.editarRegistro(reg);
    }

    @Override
    public void borrarRegistro(String id) throws Exception {
        dao.borrarRegistro(id);
    }

    @Override
    public int proximoId() {
        return dao.proximoId();
    }
}
