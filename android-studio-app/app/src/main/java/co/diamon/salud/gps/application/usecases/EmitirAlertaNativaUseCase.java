package co.diamon.salud.gps.application.usecases;

import co.diamon.salud.gps.domain.ports.NotificadorEmergenciaPort;

/**
 * Arquitectura Hexagonal - Capa de Aplicación
 * Caso de uso para emitir notificaciones y vibración de emergencia 24/7
 * dependiendo exclusivamente del puerto NotificadorEmergenciaPort.
 */
public class EmitirAlertaNativaUseCase {

    private final NotificadorEmergenciaPort notificador;

    public EmitirAlertaNativaUseCase(NotificadorEmergenciaPort notificador) {
        this.notificador = notificador;
    }

    public void emitirAlerta(String titulo, String mensaje, boolean esCritica) {
        if (notificador == null) return;
        String tituloLimpio = (titulo != null && !titulo.trim().isEmpty())
                ? titulo.trim()
                : "DiaMon Alerta 24/7";
        String mensajeLimpio = (mensaje != null && !mensaje.trim().isEmpty())
                ? mensaje.trim()
                : "Se registró una notificación del monitoreo clínico.";
        notificador.mostrarNotificacion(tituloLimpio, mensajeLimpio, esCritica);
        notificador.vibrar(esCritica);
    }

    public void vibrarSolo(boolean esCritica) {
        if (notificador == null) return;
        notificador.vibrar(esCritica);
    }
}
