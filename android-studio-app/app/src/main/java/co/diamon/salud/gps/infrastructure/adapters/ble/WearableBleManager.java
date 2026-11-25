package co.diamon.salud.gps.infrastructure.adapters.ble;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.widget.ArrayAdapter;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;

import co.diamon.salud.gps.domain.ports.WearableSensorPort;

/**
 * DiaMon — Adaptador Nativo Android Bluetooth Low Energy (BLE GATT)
 * Implementa el puerto de dominio WearableSensorPort.
 * Conecta con relojes inteligentes, anillos o bandas que expongan los perfiles
 * estándar Bluetooth SIG:
 *   - Heart Rate Service (0x180D / 0x2A37)
 *   - Health Thermometer Service (0x1809 / 0x2A1C)
 *   - Battery Service (0x180F / 0x2A19)
 */
public class WearableBleManager implements WearableSensorPort {

    public interface Listener extends WearableSensorPort.Listener {
    }

    private static final UUID UUID_HEART_RATE_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    private static final UUID UUID_HEART_RATE_CHAR = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    private static final UUID UUID_THERMO_SERVICE = UUID.fromString("00001809-0000-1000-8000-00805f9b34fb");
    private static final UUID UUID_THERMO_CHAR = UUID.fromString("00002a1c-0000-1000-8000-00805f9b34fb");
    private static final UUID UUID_BATTERY_SERVICE = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");
    private static final UUID UUID_BATTERY_CHAR = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");
    private static final UUID UUID_CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static final long SCAN_TIMEOUT_MS = 10000L;

    private final Activity activity;
    private final WearableSensorPort.Listener listener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner leScanner;
    private BluetoothGatt bluetoothGatt;
    private boolean scanning = false;
    private boolean connected = false;
    private boolean supportsTemp = false;

    private String currentDeviceName = "Reloj Inteligente BLE";
    private String currentDeviceType = "reloj_inteligente";
    private Integer lastBpm = null;
    private Double lastTempC = null;
    private Integer lastBattery = null;

    private final Map<String, BluetoothDevice> discoveredDevices = new LinkedHashMap<>();
    private final List<String> dialogLabels = new ArrayList<>();
    private ArrayAdapter<String> dialogAdapter;
    private AlertDialog scanDialog;

    private final Queue<Runnable> gattOperationQueue = new ArrayDeque<>();
    private boolean gattBusy = false;

    private final Runnable stopScanRunnable = this::detenerEscaneo;

    public WearableBleManager(Activity activity, WearableSensorPort.Listener listener) {
        this.activity = activity;
        this.listener = listener;
        BluetoothManager manager = (BluetoothManager) activity.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager != null) {
            this.bluetoothAdapter = manager.getAdapter();
        }
    }

    public boolean estaConectado() {
        return connected && bluetoothGatt != null;
    }

    public String getDeviceName() {
        return currentDeviceName;
    }

    public boolean soportaTemperatura() {
        return supportsTemp;
    }

    public boolean bluetoothDisponibleYActivo() {
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled();
    }

    @SuppressLint("MissingPermission")
    public void iniciarEscaneoYMostrarSelector(String tipoDispositivo) {
        if (tipoDispositivo != null && !tipoDispositivo.trim().isEmpty()) {
            this.currentDeviceType = tipoDispositivo.trim();
        }

        if (bluetoothAdapter == null) {
            emitirEstado("Este teléfono no tiene hardware Bluetooth BLE.", "warn");
            return;
        }
        if (!bluetoothAdapter.isEnabled()) {
            emitirEstado("Activa el Bluetooth del teléfono para conectar tu reloj o anillo.", "warn");
            return;
        }

        detenerEscaneo();
        discoveredDevices.clear();
        dialogLabels.clear();

        mainHandler.post(() -> {
            dialogAdapter = new ArrayAdapter<>(activity, android.R.layout.simple_list_item_1, dialogLabels);

            AlertDialog.Builder builder = new AlertDialog.Builder(activity);
            builder.setTitle("Conectar Reloj / Anillo BLE");
            builder.setAdapter(dialogAdapter, (dialog, which) -> {
                detenerEscaneo();
                List<BluetoothDevice> list = new ArrayList<>(discoveredDevices.values());
                if (which >= 0 && which < list.size()) {
                    conectarDispositivo(list.get(which));
                }
            });
            builder.setNegativeButton("Cancelar", (dialog, which) -> detenerEscaneo());
            builder.setNeutralButton("Reescanear", (dialog, which) -> iniciarEscaneoYMostrarSelector(currentDeviceType));
            builder.setOnCancelListener(d -> detenerEscaneo());
            scanDialog = builder.create();
            scanDialog.show();
        });

        leScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (leScanner == null) {
            emitirEstado("No se pudo iniciar el escáner Bluetooth BLE.", "warn");
            return;
        }

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

        try {
            scanning = true;
            leScanner.startScan(null, settings, scanCallback);
            mainHandler.postDelayed(stopScanRunnable, SCAN_TIMEOUT_MS);
            emitirEstado("Buscando relojes, anillos y bandas BLE cercanos...", "info");
        } catch (Exception e) {
            scanning = false;
            emitirEstado("Error iniciando escaneo BLE: " + e.getMessage(), "warn");
        }
    }

    @SuppressLint("MissingPermission")
    public void detenerEscaneo() {
        mainHandler.removeCallbacks(stopScanRunnable);
        if (scanning && leScanner != null) {
            try {
                leScanner.stopScan(scanCallback);
            } catch (Exception ignored) {
            }
        }
        scanning = false;
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @SuppressLint("MissingPermission")
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            if (result == null || result.getDevice() == null) return;
            BluetoothDevice device = result.getDevice();
            String name = device.getName();
            if (name == null || name.trim().isEmpty()) {
                if (result.getScanRecord() != null && result.getScanRecord().getDeviceName() != null) {
                    name = result.getScanRecord().getDeviceName();
                }
            }
            // Filtrar dispositivos anónimos sin nombre para mantener el selector limpio para el paciente
            if (name == null || name.trim().isEmpty()) return;

            String address = device.getAddress();
            if (discoveredDevices.containsKey(address)) return;

            discoveredDevices.put(address, device);
            final String label = name.trim() + "  (" + result.getRssi() + " dBm)\n" + address;

            mainHandler.post(() -> {
                dialogLabels.add(label);
                if (dialogAdapter != null) {
                    dialogAdapter.notifyDataSetChanged();
                }
            });
        }

        @Override
        public void onScanFailed(int errorCode) {
            scanning = false;
            emitirEstado("Escaneo BLE interrumpido (código " + errorCode + ").", "warn");
        }
    };

    @SuppressLint("MissingPermission")
    private void conectarDispositivo(BluetoothDevice device) {
        desconectar(false);

        String name = device.getName();
        currentDeviceName = (name != null && !name.trim().isEmpty()) ? name.trim() : "Wearable BLE";
        lastBpm = null;
        lastTempC = null;
        lastBattery = null;
        supportsTemp = false;
        gattOperationQueue.clear();
        gattBusy = false;

        emitirEstado("Conectando con " + currentDeviceName + "...", "info");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            bluetoothGatt = device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
        } else {
            bluetoothGatt = device.connectGatt(activity, false, gattCallback);
        }
    }

    @SuppressLint("MissingPermission")
    public void desconectar() {
        desconectar(true);
    }

    @SuppressLint("MissingPermission")
    private void desconectar(boolean notificar) {
        detenerEscaneo();
        if (scanDialog != null && scanDialog.isShowing()) {
            try { scanDialog.dismiss(); } catch (Exception ignored) {}
        }
        String prevName = currentDeviceName;
        boolean wasConnected = connected;
        connected = false;
        supportsTemp = false;
        gattOperationQueue.clear();
        gattBusy = false;

        if (bluetoothGatt != null) {
            try {
                bluetoothGatt.disconnect();
                bluetoothGatt.close();
            } catch (Exception ignored) {
            }
            bluetoothGatt = null;
        }

        if (notificar && wasConnected && listener != null) {
            mainHandler.post(() -> listener.onDisconnected(prevName));
        }
    }

    private void enqueueGattOperation(Runnable op) {
        gattOperationQueue.add(op);
        if (!gattBusy) {
            runNextGattOperation();
        }
    }

    private void runNextGattOperation() {
        Runnable next = gattOperationQueue.poll();
        if (next == null) {
            gattBusy = false;
            return;
        }
        gattBusy = true;
        try {
            next.run();
        } catch (Exception e) {
            gattBusy = false;
            runNextGattOperation();
        }
    }

    @SuppressLint("MissingPermission")
    private void enableCharacteristicNotification(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, boolean useIndication) {
        enqueueGattOperation(() -> {
            gatt.setCharacteristicNotification(characteristic, true);
            BluetoothGattDescriptor cccd = characteristic.getDescriptor(UUID_CCCD);
            if (cccd == null) {
                runNextGattOperation();
                return;
            }
            byte[] value = useIndication
                    ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                    : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeDescriptor(cccd, value);
            } else {
                cccd.setValue(value);
                gatt.writeDescriptor(cccd);
            }
        });
    }

    @SuppressLint("MissingPermission")
    private void readCharacteristicQueued(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
        enqueueGattOperation(() -> {
            boolean started = gatt.readCharacteristic(characteristic);
            if (!started) {
                runNextGattOperation();
            }
        });
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                connected = true;
                gatt.discoverServices();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                boolean wasConnected = connected;
                connected = false;
                supportsTemp = false;
                try { gatt.close(); } catch (Exception ignored) {}
                if (bluetoothGatt == gatt) {
                    bluetoothGatt = null;
                }
                if (listener != null) {
                    mainHandler.post(() -> {
                        if (wasConnected) {
                            listener.onDisconnected(currentDeviceName);
                        } else {
                            listener.onStatusMessage("No se pudo establecer conexión con " + currentDeviceName + ".", "warn");
                        }
                    });
                }
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emitirEstado("No se pudieron leer los servicios BLE de " + currentDeviceName + ".", "warn");
                return;
            }

            boolean foundHr = false;
            boolean foundTemp = false;

            BluetoothGattService hrService = gatt.getService(UUID_HEART_RATE_SERVICE);
            if (hrService != null) {
                BluetoothGattCharacteristic hrChar = hrService.getCharacteristic(UUID_HEART_RATE_CHAR);
                if (hrChar != null) {
                    foundHr = true;
                    enableCharacteristicNotification(gatt, hrChar, false);
                }
            }

            BluetoothGattService thermoService = gatt.getService(UUID_THERMO_SERVICE);
            if (thermoService != null) {
                BluetoothGattCharacteristic tempChar = thermoService.getCharacteristic(UUID_THERMO_CHAR);
                if (tempChar != null) {
                    foundTemp = true;
                    boolean supportsIndicate = (tempChar.getProperties() & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0;
                    enableCharacteristicNotification(gatt, tempChar, supportsIndicate);
                }
            }

            BluetoothGattService batteryService = gatt.getService(UUID_BATTERY_SERVICE);
            if (batteryService != null) {
                BluetoothGattCharacteristic batChar = batteryService.getCharacteristic(UUID_BATTERY_CHAR);
                if (batChar != null) {
                    readCharacteristicQueued(gatt, batChar);
                }
            }

            supportsTemp = foundTemp;
            final boolean hasHr = foundHr;
            final boolean hasTemp = foundTemp;

            if (listener != null) {
                mainHandler.post(() -> {
                    if (!hasHr && !hasTemp) {
                        listener.onStatusMessage(
                                currentDeviceName + " conectado, pero no expone perfil BLE estándar de pulso (0x180D). Usa puente HTTP o Health Connect.",
                                "warn"
                        );
                    }
                    listener.onConnected(currentDeviceName, currentDeviceType, hasTemp);
                });
            }
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
            runNextGattOperation();
        }

        @Override
        public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS && value != null) {
                procesarCaracteristica(characteristic.getUuid(), value);
            }
            runNextGattOperation();
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && status == BluetoothGatt.GATT_SUCCESS) {
                byte[] value = characteristic.getValue();
                if (value != null) {
                    procesarCaracteristica(characteristic.getUuid(), value);
                }
            }
            runNextGattOperation();
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value) {
            if (value != null) {
                procesarCaracteristica(characteristic.getUuid(), value);
            }
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                byte[] value = characteristic.getValue();
                if (value != null) {
                    procesarCaracteristica(characteristic.getUuid(), value);
                }
            }
        }
    };

    private void procesarCaracteristica(UUID uuid, byte[] data) {
        if (UUID_BATTERY_CHAR.equals(uuid) && data.length >= 1) {
            lastBattery = data[0] & 0xFF;
            return;
        }

        if (UUID_HEART_RATE_CHAR.equals(uuid) && data.length >= 2) {
            int flags = data[0] & 0xFF;
            boolean isUint16 = (flags & 0x01) != 0;
            int bpm;
            if (isUint16 && data.length >= 3) {
                bpm = (data[1] & 0xFF) | ((data[2] & 0xFF) << 8);
            } else {
                bpm = data[1] & 0xFF;
            }
            if (bpm >= 30 && bpm <= 240) {
                lastBpm = bpm;
                notificarLectura();
            }
            return;
        }

        if (UUID_THERMO_CHAR.equals(uuid) && data.length >= 5) {
            Double tempC = decodificarTemperaturaIEEE11073(data);
            if (tempC != null) {
                lastTempC = tempC;
                if (lastBpm != null) {
                    notificarLectura();
                }
            }
        }
    }

    private Double decodificarTemperaturaIEEE11073(byte[] data) {
        int flags = data[0] & 0xFF;
        boolean esFahrenheit = (flags & 0x01) != 0;

        int raw = (data[1] & 0xFF)
                | ((data[2] & 0xFF) << 8)
                | ((data[3] & 0xFF) << 16)
                | ((data[4] & 0xFF) << 24);

        int exponent = (byte) ((raw >> 24) & 0xFF);
        int mantissa = raw & 0x00FFFFFF;
        if ((mantissa & 0x00800000) != 0) {
            mantissa |= 0xFF000000; // Extensión de signo a 32 bits
        }

        double valor = mantissa * Math.pow(10.0, exponent);
        if (esFahrenheit) {
            valor = (valor - 32.0) * (5.0 / 9.0);
        }

        if (Double.isNaN(valor) || valor < 30.0 || valor > 45.0) {
            return null;
        }
        return Math.round(valor * 10.0) / 10.0;
    }

    private void notificarLectura() {
        if (listener == null || lastBpm == null) return;
        final int bpm = lastBpm;
        final Double temp = lastTempC;
        final Integer bat = lastBattery;
        final String name = currentDeviceName;
        final String type = currentDeviceType;
        mainHandler.post(() -> listener.onReading(bpm, temp, bat, name, type));
    }

    private void emitirEstado(String mensaje, String nivel) {
        if (listener != null) {
            mainHandler.post(() -> listener.onStatusMessage(mensaje, nivel));
        }
    }
}
