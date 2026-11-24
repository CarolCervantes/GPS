package co.diamon.salud.gps.dao;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.SQLException;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteException;
import android.database.sqlite.SQLiteOpenHelper;

public class ConexionBasedatos extends SQLiteOpenHelper {

    public final static int MODO_LECTURA = 0;
    public final static int MODO_ESCRITURA = 1;

    private SQLiteDatabase conexion;
    private String nombreBD;
    private int versionBD;
    private Context actividad;
    private String estado = "";

    public ConexionBasedatos(Context actividad, String nombreBD, SQLiteDatabase.CursorFactory cursor, int versionBD) {
        super(actividad, nombreBD, cursor, versionBD);
        this.nombreBD = nombreBD;
        this.versionBD = versionBD;
        this.actividad = actividad;
        this.estado = "Instancia SI";
    }

    @Override
    public void onCreate(SQLiteDatabase bd) {
        try {
            String[] sentencias = CodigoSQLBackup.sqlBackup.split(";");
            for (String sentencia : sentencias) {
                if (sentencia.trim().length() > 0) {
                    bd.execSQL(sentencia.trim());
                }
            }
            this.estado += " onCreate Ok\n";
        } catch (SQLiteException e) {
            this.estado += " onCreate NO\n";
        }
    }

    @Override
    public void onUpgrade(SQLiteDatabase bd, int versionActual, int versionNueva) {
        try {
            String[] sentencias = CodigoSQLBackup.sqlBackup.split(";");
            for (String sentencia : sentencias) {
                if (sentencia.trim().length() > 0) {
                    bd.execSQL(sentencia.trim());
                }
            }
            this.estado += " onUpgrade SI\n";
        } catch (SQLiteException e) {
            this.estado += " onUpgrade NO\n";
        }
    }

    public void conectar(int modo) throws Exception {
        try {
            if (modo == ConexionBasedatos.MODO_ESCRITURA) {
                conexion = this.getWritableDatabase();
                estado += " Conexion Read/Write SI\n";
            } else {
                conexion = this.getReadableDatabase();
                estado += " Conexion Read SI\n";
            }
        } catch (SQLiteException error) {
            estado += " Conexion Read/Write NO\n";
            throw new Exception("ERROR: Sin conexion a la BD\nMensaje: " + error.getMessage());
        }
    }

    public void desconectar() {
        if (conexion != null && conexion.isOpen()) {
            conexion.close();
            estado += " Desconexion SI\n";
        }
        conexion = null;
    }

    public void insertar(String tabla, ContentValues columnasValor) throws Exception {
        try {
            conexion.insertOrThrow(tabla, null, columnasValor);
        } catch (SQLException e) {
            throw new Exception("Mensaje: " + e.getMessage());
        }
    }

    public void actualizar(String tabla, ContentValues columnasValor, String whereColumnasIgualValor, String[] valorWhere) {
        conexion.update(tabla, columnasValor, whereColumnasIgualValor, valorWhere);
    }

    public void eliminar(String sqlDelete, String[] valorWhere) {
        conexion.execSQL(sqlDelete, valorWhere);
    }

    public Cursor consultar(String consultaSQL, String[] valorWhere) {
        return conexion.rawQuery(consultaSQL, valorWhere);
    }

    public String getEstado() {
        return estado;
    }
}
