package co.diamon.salud.gps.domain.ports;

/**
 * Arquitectura Hexagonal - Puerto de Salida (Notificador de Emergencias 24/7)
 * Interfaz pura de dominio sin dependencias del SDK de Android.
 */
public interface NotificadorEmergenciaPort {
    void mostrarNotificacion(String titulo, String mensaje, boolean esCritica);
    void vibrar(boolean esCritica);
}
