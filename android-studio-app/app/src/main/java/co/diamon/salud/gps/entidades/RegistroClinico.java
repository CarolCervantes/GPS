package co.diamon.salud.gps.entidades;

public class RegistroClinico {

    // Propiedades correspondientes a las columnas de la tabla RegistrosClinicos
    private String id;
    private String paciente;
    private String glucosa;
    private String presion;
    private String medicamento;
    private String ubicacion;

    // Constructor vacio
    public RegistroClinico() {
    }

    // Constructor con todos los campos
    public RegistroClinico(String id, String paciente, String glucosa, String presion, String medicamento, String ubicacion) {
        this.id = id;
        this.paciente = paciente;
        this.glucosa = glucosa;
        this.presion = presion;
        this.medicamento = medicamento;
        this.ubicacion = ubicacion;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPaciente() {
        return paciente;
    }

    public void setPaciente(String paciente) {
        this.paciente = paciente;
    }

    public String getGlucosa() {
        return glucosa;
    }

    public void setGlucosa(String glucosa) {
        this.glucosa = glucosa;
    }

    public String getPresion() {
        return presion;
    }

    public void setPresion(String presion) {
        this.presion = presion;
    }

    public String getMedicamento() {
        return medicamento;
    }

    public void setMedicamento(String medicamento) {
        this.medicamento = medicamento;
    }

    public String getUbicacion() {
        return ubicacion;
    }

    public void setUbicacion(String ubicacion) {
        this.ubicacion = ubicacion;
    }
}
