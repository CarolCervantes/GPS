package co.diamon.salud.gps;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import co.diamon.salud.gps.application.usecases.GestionarRegistroClinicoUseCase;
import co.diamon.salud.gps.domain.entities.RegistroClinico;
import co.diamon.salud.gps.infrastructure.di.AndroidHexagonalContainer;

public class ActividadCrudClinico extends Activity {

    private EditText campoId;
    private EditText campoPaciente;
    private EditText campoGlucosa;
    private EditText campoPresion;
    private EditText campoMedicamento;
    private EditText campoUbicacion;

    // Caso de uso Hexagonal (conecta SQLite local + Supabase en la nube)
    private GestionarRegistroClinicoUseCase casoDeUso;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.layout_actividad_crud_clinico);

        campoId = (EditText) findViewById(R.id.campoId);
        campoPaciente = (EditText) findViewById(R.id.campoPaciente);
        campoGlucosa = (EditText) findViewById(R.id.campoGlucosa);
        campoPresion = (EditText) findViewById(R.id.campoPresion);
        campoMedicamento = (EditText) findViewById(R.id.campoMedicamento);
        campoUbicacion = (EditText) findViewById(R.id.campoUbicacion);

        try {
            casoDeUso = AndroidHexagonalContainer.crearCasoDeUsoRegistrosClinicos(this);
            int proximo = casoDeUso.obtenerProximoId();
            campoId.setText("" + proximo);
        } catch (Exception e) {
            Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    // guardar un nuevo registro clinico en SQLite y sincronizar con Supabase
    public void agregarRegistro(View campo) {
        String paciente = campoPaciente.getText().toString().trim();
        String glucosa = campoGlucosa.getText().toString().trim();
        String presion = campoPresion.getText().toString().trim();
        String medicamento = campoMedicamento.getText().toString().trim();
        String ubicacion = campoUbicacion.getText().toString().trim();

        if (glucosa.isEmpty() || presion.isEmpty()) {
            Toast.makeText(this, "La glucosa y la presion arterial son requeridas", Toast.LENGTH_SHORT).show();
            return;
        }

        String id = campoId.getText().toString().trim();
        RegistroClinico r = new RegistroClinico(id, paciente, glucosa, presion, medicamento, ubicacion);

        try {
            casoDeUso.guardar(r);
            Toast.makeText(getApplicationContext(), "Guardado en SQLite y sincronizado con Supabase", Toast.LENGTH_LONG).show();
            limpiarCampos(campo);
        } catch (Exception e) {
            Toast.makeText(getApplicationContext(), "ERROR: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    // limpiar los datos del formulario
    public void limpiarCampos(View componente) {
        campoPaciente.setText("Damián Díaz Balseiro");
        campoGlucosa.setText("");
        campoPresion.setText("");
        campoMedicamento.setText("");
        campoUbicacion.setText("Casa Chapacuá (Lat: 10.39991, Lng: -75.47886)");
        try {
            int proximo = casoDeUso.obtenerProximoId();
            campoId.setText("" + proximo);
        } catch (Exception e) {
        }
        campoGlucosa.requestFocus();
    }

    // desplegar cuadro de dialogo de busqueda por ID
    public void mostrarCuadroDialogoId(final View componente) {
        LayoutInflater layoutEmergente = LayoutInflater.from(this);
        View formularioId = layoutEmergente.inflate(R.layout.layout_dialog_buscar_id, null);

        AlertDialog.Builder dialogoId = new AlertDialog.Builder(this);
        dialogoId.setView(formularioId);

        final EditText campoBuscarId = (EditText) formularioId.findViewById(R.id.campoBuscarId);
        dialogoId.setCancelable(false);

        dialogoId.setPositiveButton("OK", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                campoId.setText(campoBuscarId.getText().toString());
                buscarRegistro(componente);
            }
        });

        dialogoId.setNegativeButton("Cancelar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.cancel();
                limpiarCampos(componente);
            }
        });

        dialogoId.create().show();
    }

    // consultar un registro clinico
    public void buscarRegistro(View campo) {
        String id = campoId.getText().toString().trim();
        try {
            RegistroClinico r = casoDeUso.buscarPorId(id);
            campoPaciente.setText(r.getPaciente());
            campoGlucosa.setText(r.getGlucosa());
            campoPresion.setText(r.getPresion());
            campoMedicamento.setText(r.getMedicamento());
            campoUbicacion.setText(r.getUbicacion());
            Toast.makeText(getApplicationContext(), "Registro clinico encontrado", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(getApplicationContext(), "ERROR: " + e.getMessage(), Toast.LENGTH_LONG).show();
            limpiarCampos(campo);
        }
    }

    // modificar un registro clinico existente
    public void modificarRegistro(View campo) {
        String id = campoId.getText().toString().trim();
        String paciente = campoPaciente.getText().toString().trim();
        String glucosa = campoGlucosa.getText().toString().trim();
        String presion = campoPresion.getText().toString().trim();
        String medicamento = campoMedicamento.getText().toString().trim();
        String ubicacion = campoUbicacion.getText().toString().trim();

        if (glucosa.isEmpty() || presion.isEmpty()) {
            Toast.makeText(this, "Busque primero un registro o complete glucosa y presion", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            RegistroClinico r = new RegistroClinico(id, paciente, glucosa, presion, medicamento, ubicacion);
            casoDeUso.modificar(r);
            Toast.makeText(getApplicationContext(), "Modificado y sincronizado con Supabase", Toast.LENGTH_LONG).show();
            limpiarCampos(campo);
        } catch (Exception e) {
            Toast.makeText(getApplicationContext(), "ERROR al modificar: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    // eliminar el registro clinico consultado
    public void eliminarRegistro(final View campo) {
        final String id = campoId.getText().toString().trim();

        AlertDialog.Builder confirmacion = new AlertDialog.Builder(this);
        confirmacion.setTitle("Confirmar eliminacion");
        confirmacion.setMessage("¿Desea eliminar el registro clinico con ID " + id + "?");
        confirmacion.setCancelable(false);

        confirmacion.setPositiveButton("Si, eliminar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                try {
                    casoDeUso.eliminar(id);
                    Toast.makeText(getApplicationContext(), "Registro eliminado correctamente", Toast.LENGTH_LONG).show();
                    limpiarCampos(campo);
                } catch (Exception e) {
                    Toast.makeText(getApplicationContext(), "ERROR al eliminar: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
        });

        confirmacion.setNegativeButton("Cancelar", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
            }
        });

        confirmacion.create().show();
    }

    public void abrirDashboardMapa(View componente) {
        finish();
    }
}
