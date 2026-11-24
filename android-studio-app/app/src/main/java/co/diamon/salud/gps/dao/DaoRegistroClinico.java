package co.diamon.salud.gps.dao;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;

import java.util.ArrayList;
import java.util.List;

import co.diamon.salud.gps.domain.entities.RegistroClinico;
import co.diamon.salud.gps.domain.ports.RegistroClinicoRepositoryPort;

public class DaoRegistroClinico implements RegistroClinicoRepositoryPort {

    private ConexionBasedatos bd;

    public DaoRegistroClinico(Context actividad, String nombre, int version) throws Exception {
        try {
            bd = new ConexionBasedatos(actividad, nombre, null, version);
            bd.conectar(ConexionBasedatos.MODO_ESCRITURA);
        } catch (Exception e) {
            throw new Exception(e.getMessage());
        }
    }

    // agregar un registro clinico a SQLite
    public void agregarRegistro(RegistroClinico reg) throws Exception {
        ContentValues args = new ContentValues();

        if (reg.getId() != null && !reg.getId().trim().isEmpty()) {
            args.put("id", Integer.parseInt(reg.getId()));
        }

        args.put("paciente", (reg.getPaciente() != null && !reg.getPaciente().trim().isEmpty()) ? reg.getPaciente() : "Damian Diaz Balseiro");

        if (reg.getGlucosa() != null && !reg.getGlucosa().trim().isEmpty()) {
            args.put("glucosa", reg.getGlucosa());
        } else {
            throw new Exception("La glucosa es requerida");
        }

        if (reg.getPresion() != null && !reg.getPresion().trim().isEmpty()) {
            args.put("presion", reg.getPresion());
        } else {
            throw new Exception("La presion arterial es requerida");
        }

        args.put("medicamento", reg.getMedicamento() != null ? reg.getMedicamento() : "");
        args.put("ubicacion", reg.getUbicacion() != null ? reg.getUbicacion() : "Chapacua (10.39991, -75.47886)");

        try {
            bd.insertar("RegistrosClinicos", args);
        } catch (Exception e) {
            throw new Exception("ERROR AL GUARDAR REGISTRO\nMensaje: " + e.getMessage());
        }
    }

    public RegistroClinico getRegistro(Cursor resultado) {
        RegistroClinico r = new RegistroClinico();
        r.setId(resultado.getString(0));
        r.setPaciente(resultado.getString(1));
        r.setGlucosa(resultado.getString(2));
        r.setPresion(resultado.getString(3));
        r.setMedicamento(resultado.getString(4));
        r.setUbicacion(resultado.getString(5));
        return r;
    }

    // buscar un registro por ID
    public RegistroClinico consultarUnRegistro(String id) throws Exception {
        String[] args = {id};
        Cursor resultado = bd.consultar("SELECT * FROM RegistrosClinicos WHERE id=?", args);

        if (resultado.moveToFirst()) {
            return getRegistro(resultado);
        } else {
            throw new Exception("El registro clinico " + id + " no existe");
        }
    }

    // modificar un registro existente
    public void editarRegistro(RegistroClinico reg) {
        ContentValues col = new ContentValues();
        col.put("paciente", reg.getPaciente());
        col.put("glucosa", reg.getGlucosa());
        col.put("presion", reg.getPresion());
        col.put("medicamento", reg.getMedicamento());
        col.put("ubicacion", reg.getUbicacion());

        String[] where = {reg.getId()};
        bd.actualizar("RegistrosClinicos", col, "id=?", where);
    }

    // eliminar un registro por ID
    public void borrarRegistro(String id) {
        String sqlDelete = "DELETE FROM RegistrosClinicos WHERE id = ?";
        String[] where = {id};
        bd.eliminar(sqlDelete, where);
    }

    // calcular el siguiente ID disponible
    public int proximoId() {
        Cursor c = bd.consultar("SELECT id FROM RegistrosClinicos ORDER BY id ASC", null);
        int esperado = 1;

        if (c != null) {
            while (c.moveToNext()) {
                int actual = c.getInt(0);
                if (actual == esperado) {
                    esperado++;
                } else if (actual > esperado) {
                    c.close();
                    return esperado;
                }
            }
            c.close();
        }
        return esperado;
    }
}
