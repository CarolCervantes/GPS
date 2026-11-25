package co.diamon.salud.gps;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import co.diamon.salud.gps.application.usecases.EmitirAlertaNativaUseCase;
import co.diamon.salud.gps.domain.ports.WearableSensorPort;
import co.diamon.salud.gps.infrastructure.di.AndroidHexagonalContainer;

/**
 * Actividad principal de DiaMon GPS en Android Studio.
 * Integra:
 *  - WebView seguro (HTTPS estricto + assets locales de DiaMon)
 *  - Puente nativo Bluetooth BLE (WearableBleManager) para relojes/anillos sin parche
 *  - Notificaciones nativas Android 24/7 + vibración de emergencia
 *  - Exportación real de respaldos JSON e impresión nativa de Reportes PDF
 *  - Acceso a la actividad nativa CRUD SQLite + Supabase (ActividadCrudClinico)
 */
public class MainActivity extends AppCompatActivity {

    private static final int INITIAL_PERMISSIONS_CODE = 1001;
    private static final int BLE_PERMISSIONS_CODE = 1002;
    private static final int AUDIO_PERMISSION_CODE = 1003;
    private static final String DIAMON_LOGIN_URL = "file:///android_asset/pages/login.html";

    private WebView webView;
    private WearableSensorPort bleSensorPort;
    private EmitirAlertaNativaUseCase emitirAlertaUseCase;
    private String tipoDispositivoBlePendiente = "reloj_inteligente";
    private PermissionRequest pendingWebAudioRequest = null;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        configurarBarrasSistema();
        aplicarInsetsSeguros();

        webView = findViewById(R.id.webViewDiaMon);
        emitirAlertaUseCase = AndroidHexagonalContainer.crearCasoDeUsoAlertasNativas(this);
        inicializarGestorBle();

        solicitarPermisosIniciales();
        configurarWebView();
        configurarBotonAtras();

        webView.loadUrl(DIAMON_LOGIN_URL);
    }

    private void configurarBarrasSistema() {
        try {
            getWindow().setStatusBarColor(Color.parseColor("#061B2E"));
            getWindow().setNavigationBarColor(Color.parseColor("#061B2E"));
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(false);
            }
        } catch (Exception ignored) {
        }
    }

    private void aplicarInsetsSeguros() {
        View root = findViewById(R.id.rootMainContainer);
        if (root == null) return;
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
    }

    private void configurarBotonAtras() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    private void inicializarGestorBle() {
        bleSensorPort = AndroidHexagonalContainer.crearAdaptadorWearableBle(this, new WearableSensorPort.Listener() {
            @Override
            public void onConnected(String deviceName, String deviceType, boolean supportsTemperature) {
                actualizarBotonBleUI(true, deviceName);
                try {
                    JSONObject meta = new JSONObject();
                    meta.put("conectado", true);
                    meta.put("nombre", deviceName);
                    meta.put("dispositivoTipo", deviceType);
                    meta.put("soportaTemperatura", supportsTemperature);
                    ejecutarJsSeguro("window.DiaMonWearableBridge && window.DiaMonWearableBridge.onNativeBleStatus && window.DiaMonWearableBridge.onNativeBleStatus(" + meta.toString() + ");");
                } catch (Exception ignored) {
                }
            }

            @Override
            public void onReading(int bpm, Double tempC, Integer battery, String deviceName, String deviceType) {
                try {
                    JSONObject reading = new JSONObject();
                    reading.put("ritmoCardiacoBpm", bpm);
                    if (tempC != null) {
                        reading.put("temperaturaC", tempC);
                    } else {
                        reading.put("temperaturaC", JSONObject.NULL);
                    }
                    if (battery != null) {
                        reading.put("bateriaDispositivo", battery);
                    }
                    reading.put("dispositivoNombre", deviceName);
                    reading.put("dispositivoTipo", deviceType);
                    reading.put("fuente", "ble_android_nativo");
                    ejecutarJsSeguro("window.DiaMonWearableBridge && window.DiaMonWearableBridge.inyectarLecturaExterna(" + reading.toString() + ");");
                } catch (Exception ignored) {
                }
            }

            @Override
            public void onDisconnected(String deviceName) {
                actualizarBotonBleUI(false, null);
                try {
                    JSONObject meta = new JSONObject();
                    meta.put("conectado", false);
                    meta.put("nombre", deviceName);
                    ejecutarJsSeguro("window.DiaMonWearableBridge && window.DiaMonWearableBridge.onNativeBleStatus && window.DiaMonWearableBridge.onNativeBleStatus(" + meta.toString() + ");");
                } catch (Exception ignored) {
                }
            }

            @Override
            public void onStatusMessage(String message, String level) {
                try {
                    String safeMsg = JSONObject.quote(message);
                    String safeLvl = JSONObject.quote(level != null ? level : "info");
                    ejecutarJsSeguro("window.mostrarNotificacion && window.mostrarNotificacion(" + safeMsg + ", " + safeLvl + ");");
                } catch (Exception ignored) {
                }
            }
        });
    }

    private void actualizarBotonBleUI(boolean conectado, String nombre) {
        // Estado BLE se refleja directamente en la interfaz de la app vía DiaMonWearableBridge
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configurarWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        webView.addJavascriptInterface(new DiaMonAndroidBridge(), "DiaMonAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                ejecutarJsSeguro("document.body && document.body.classList.add('dm-android-app');");
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";

                if ("javascript".equalsIgnoreCase(scheme)) {
                    return true;
                }
                if ("tel".equals(scheme) || "mailto".equals(scheme) || "sms".equals(scheme)
                        || host.contains("wa.me") || host.contains("maps.google.com") || host.equals("maps.app.goo.gl")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "No se encontró aplicación para abrir este enlace.", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] resources = request.getResources();
                    boolean pideAudio = false;
                    for (String res : resources) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                            pideAudio = true;
                            break;
                        }
                    }
                    if (!pideAudio) {
                        request.deny();
                        return;
                    }
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingWebAudioRequest = request;
                        ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.RECORD_AUDIO},
                                AUDIO_PERMISSION_CODE
                        );
                    }
                });
            }
        });
    }

    private void ejecutarJsSeguro(final String script) {
        if (webView == null) return;
        runOnUiThread(() -> {
            try {
                webView.evaluateJavascript(script, null);
            } catch (Exception ignored) {
            }
        });
    }

    // ============================================================
    // ACCIONES DE LA BARRA SUPERIOR NATIVA
    // ============================================================
    public void conectarODesconectarReloj(View component) {
        if (bleSensorPort != null && bleSensorPort.estaConectado()) {
            bleSensorPort.desconectar();
            Toast.makeText(this, "Dispositivo wearable desconectado.", Toast.LENGTH_SHORT).show();
        } else {
            iniciarFlujoBleConPermisos("reloj_inteligente");
        }
    }

    public void mostrarCrudClinico(View component) {
        Intent intento = new Intent(this, ActividadCrudClinico.class);
        startActivity(intento);
    }

    public void irALogin(View component) {
        if (webView != null) {
            webView.loadUrl(DIAMON_LOGIN_URL);
        }
    }

    // ============================================================
    // GESTIÓN DE PERMISOS NATIVOS ANDROID
    // ============================================================
    private void solicitarPermisosIniciales() {
        List<String> faltantes = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            faltantes.add(Manifest.permission.ACCESS_FINE_LOCATION);
            faltantes.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                faltantes.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!faltantes.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    faltantes.toArray(new String[0]),
                    INITIAL_PERMISSIONS_CODE
            );
        }
    }

    private void iniciarFlujoBleConPermisos(String tipoDispositivo) {
        tipoDispositivoBlePendiente = (tipoDispositivo != null && !tipoDispositivo.isEmpty())
                ? tipoDispositivo
                : "reloj_inteligente";

        List<String> permisosBle = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                    != PackageManager.PERMISSION_GRANTED) {
                permisosBle.add(Manifest.permission.BLUETOOTH_SCAN);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED) {
                permisosBle.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                permisosBle.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
        }

        if (!permisosBle.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    permisosBle.toArray(new String[0]),
                    BLE_PERMISSIONS_CODE
            );
            return;
        }

        if (bleSensorPort != null) {
            bleSensorPort.iniciarEscaneoYMostrarSelector(tipoDispositivoBlePendiente);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == INITIAL_PERMISSIONS_CODE) {
            boolean grantedLocation = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
            if (grantedLocation && webView != null) {
                webView.reload();
            }
            return;
        }

        if (requestCode == BLE_PERMISSIONS_CODE) {
            boolean todosConcedidos = grantResults.length > 0;
            for (int r : grantResults) {
                if (r != PackageManager.PERMISSION_GRANTED) {
                    todosConcedidos = false;
                    break;
                }
            }
            if (todosConcedidos && bleSensorPort != null) {
                bleSensorPort.iniciarEscaneoYMostrarSelector(tipoDispositivoBlePendiente);
            } else {
                Toast.makeText(this, "Permiso Bluetooth necesario para vincular tu reloj o anillo.", Toast.LENGTH_LONG).show();
            }
            return;
        }

        if (requestCode == AUDIO_PERMISSION_CODE && pendingWebAudioRequest != null) {
            boolean grantedAudio = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (grantedAudio) {
                pendingWebAudioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                pendingWebAudioRequest.deny();
            }
            pendingWebAudioRequest = null;
        }
    }

    // ============================================================
    // PUENTE JAVASCRIPT <-> ANDROID NATIVO (window.DiaMonAndroid)
    // ============================================================
    private class DiaMonAndroidBridge {

        @JavascriptInterface
        public boolean esAppAndroid() {
            return true;
        }

        @JavascriptInterface
        public void abrirCrudSqlite() {
            runOnUiThread(() -> {
                Intent intento = new Intent(MainActivity.this, ActividadCrudClinico.class);
                startActivity(intento);
            });
        }

        @JavascriptInterface
        public void escanearYConectarWearable(final String tipoDispositivo) {
            runOnUiThread(() -> iniciarFlujoBleConPermisos(tipoDispositivo));
        }

        @JavascriptInterface
        public void desconectarWearable() {
            runOnUiThread(() -> {
                if (bleSensorPort != null) {
                    bleSensorPort.desconectar();
                }
            });
        }

        @JavascriptInterface
        public String obtenerEstadoWearableJson() {
            try {
                JSONObject obj = new JSONObject();
                obj.put("conectado", bleSensorPort != null && bleSensorPort.estaConectado());
                obj.put("nombre", bleSensorPort != null ? bleSensorPort.getDeviceName() : "");
                obj.put("soportaTemperatura", bleSensorPort != null && bleSensorPort.soportaTemperatura());
                obj.put("bluetoothActivo", bleSensorPort != null && bleSensorPort.bluetoothDisponibleYActivo());
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void dispararNotificacionNativa(final String titulo, final String mensaje, final boolean esCritica) {
            runOnUiThread(() -> {
                if (emitirAlertaUseCase != null) {
                    emitirAlertaUseCase.emitirAlerta(titulo, mensaje, esCritica);
                }
            });
        }

        @JavascriptInterface
        public void vibrarEmergencia(final boolean esCritica) {
            runOnUiThread(() -> {
                if (emitirAlertaUseCase != null) {
                    emitirAlertaUseCase.vibrarSolo(esCritica);
                }
            });
        }

        @JavascriptInterface
        public void abrirMarcadorTelefono(final String numero) {
            runOnUiThread(() -> {
                if (numero == null || numero.trim().isEmpty()) return;
                try {
                    Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + numero.trim()));
                    startActivity(intent);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void exportarRespaldoJson(final String nombreArchivo, final String contenidoJson) {
            runOnUiThread(() -> {
                try {
                    String safeName = (nombreArchivo != null && nombreArchivo.endsWith(".json"))
                            ? nombreArchivo.replaceAll("[^a-zA-Z0-9._-]", "_")
                            : "diamon-respaldo.json";
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
                    if (dir == null) dir = getFilesDir();
                    if (!dir.exists()) dir.mkdirs();

                    File outFile = new File(dir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write((contenidoJson != null ? contenidoJson : "{}").getBytes(StandardCharsets.UTF_8));
                    }

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("application/json");
                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Respaldo Clínico DiaMon — " + safeName);
                    shareIntent.putExtra(Intent.EXTRA_TEXT, contenidoJson != null ? contenidoJson : "{}");
                    startActivity(Intent.createChooser(shareIntent, "Guardar o compartir respaldo DiaMon"));

                    Toast.makeText(MainActivity.this, "Respaldo guardado: " + outFile.getName(), Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Error al exportar respaldo: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void imprimirReportePdf() {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null || webView == null) return;
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("Reporte_Clinico_DiaMon");
                    printManager.print("Reporte Clínico DiaMon", adapter, new PrintAttributes.Builder().build());
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No se pudo abrir el generador PDF de Android.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (bleSensorPort != null) {
            bleSensorPort.desconectar();
        }
        super.onDestroy();
    }
}
