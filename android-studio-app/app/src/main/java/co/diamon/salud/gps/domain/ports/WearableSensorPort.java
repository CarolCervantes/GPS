package co.diamon.salud.gps.domain.ports;

/**
 * Arquitectura Hexagonal - Puerto de Salida (Wearable BLE)
 * Interfaz pura de dominio sin dependencias del SDK de Android.
 */
public interface WearableSensorPort {

    interface Listener {
        void onConnected(String deviceName, String deviceType, boolean supportsTemperature);
        void onReading(int bpm, Double tempC, Integer battery, String deviceName, String deviceType);
        void onDisconnected(String deviceName);
        void onStatusMessage(String message, String level);
    }

    void iniciarEscaneoYMostrarSelector(String tipoDispositivo);

    void desconectar();

    boolean estaConectado();

    String getDeviceName();

    boolean soportaTemperatura();

    boolean bluetoothDisponibleYActivo();
}
