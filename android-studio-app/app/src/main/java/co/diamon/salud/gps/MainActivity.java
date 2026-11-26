package co.diamon.salud.gps;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import android.view.ViewGroup;
import org.json.JSONObject;
import org.json.JSONTokener;

// Actividad principal de DiaMon GPS.
// Muestra la misma web del proyecto (copiada en assets con "npm run android:sync") dentro de un WebView,
// pide los permisos de ubicacion y notificaciones, y abre la actividad nativa del CRUD SQLite.
public class MainActivity extends AppCompatActivity {

    private static final int LOCATION_PERMISSION_CODE = 1001;
    private static final String DIAMON_LOGIN_URL = "file:///android_asset/pages/login.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Android 15 dibuja la app debajo de la barra de estado y de los botones de abajo.
        // Se deja un margen del tamano de esas barras para que nada quede tapado.
        View raiz = ((ViewGroup) findViewById(android.R.id.content)).getChildAt(0);
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets barras = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(barras.left, barras.top, barras.right, barras.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        webView = findViewById(R.id.webViewDiaMon);
        solicitarPermisos();

        // La pantalla no se apaga mientras la app esta abierta, asi el GPS del paciente sigue transmitiendo
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

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
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Con esto la web sabe que esta dentro de la app y esconde lo que solo sirve en el navegador
        settings.setUserAgentString(settings.getUserAgentString() + " DiaMonApp");
        // Permite revisar la web desde chrome://inspect cuando el celular esta conectado
        WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";

                if ("javascript".equalsIgnoreCase(scheme)) {
                    return true;
                }
                String ruta = uri.getPath() != null ? uri.getPath() : "";
                boolean esMapa = host.contains("maps.google.com") || (host.contains("google.com") && ruta.startsWith("/maps"));
                // Llamadas, WhatsApp y Google Maps se abren en su propia app
                if ("tel".equals(scheme) || "mailto".equals(scheme) || host.contains("wa.me") || esMapa) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                sincronizarSesionSupabaseEnPrefs(view);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            // Los mensajes y errores de la web salen en el Logcat con la etiqueta DiaMonWeb
            @Override
            public boolean onConsoleMessage(ConsoleMessage mensaje) {
                Log.d("DiaMonWeb", mensaje.messageLevel() + " " + mensaje.message() + " (" + mensaje.sourceId() + ":" + mensaje.lineNumber() + ")");
                return true;
            }
        });

        // Puente para que la web le pida a Android la ubicacion en segundo plano
        webView.addJavascriptInterface(new PuenteNativo(), "DiaMonNativo");

        // Al abrir la app por primera vez carga Login / Registro
        webView.loadUrl(DIAMON_LOGIN_URL);
    }

    // abre la actividad nativa de CRUD SQLite (Guardar, Buscar, Limpiar, Modificar, Eliminar)
    private void mostrarCrudClinico() {
        startActivity(new Intent(this, ActividadCrudClinico.class));
    }

    private void sincronizarSesionSupabaseEnPrefs(WebView view) {
        if (view == null) return;
        String js = "(function(){try{"
                + "var keys=Object.keys(localStorage);"
                + "for(var i=0;i<keys.length;i++){"
                + "var k=keys[i];"
                + "if(k.indexOf('sb-')===0&&k.slice(-11)==='-auth-token'){"
                + "var s=JSON.parse(localStorage.getItem(k)||'null');"
                + "if(s&&s.access_token){"
                + "return JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token||'',user_id:(s.user&&s.user.id)||''});"
                + "}"
                + "}"
                + "}"
                + "}catch(e){}return JSON.stringify({access_token:'',user_id:''});})();";

        view.evaluateJavascript(js, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value == null || "null".equals(value)) return;
                try {
                    Object parsedVal = new JSONTokener(value).nextValue();
                    String jsonStr = (parsedVal instanceof String) ? (String) parsedVal : value;
                    JSONObject obj = new JSONObject(jsonStr);
                    String token = obj.optString("access_token", "");
                    String userId = obj.optString("user_id", "");
                    String refresh = obj.optString("refresh_token", "");

                    SharedPreferences prefs = getSharedPreferences("diamon_supabase_auth", MODE_PRIVATE);
                    SharedPreferences.Editor editor = prefs.edit();
                    if (!token.isEmpty() && !userId.isEmpty()) {
                        editor.putString("access_token", token);
                        editor.putString("user_id", userId);
                        editor.putString("refresh_token", refresh);
                    } else {
                        editor.remove("access_token");
                        editor.remove("user_id");
                        editor.remove("refresh_token");
                    }
                    editor.apply();
                } catch (Exception ignored) {
                }
            }
        });
    }

    // Pide ubicacion (para el GPS) y, desde Android 13, permiso para mostrar notificaciones
    private void solicitarPermisos() {
        java.util.List<String> faltan = new java.util.ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            faltan.add(Manifest.permission.ACCESS_FINE_LOCATION);
            faltan.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            faltan.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!faltan.isEmpty()) {
            ActivityCompat.requestPermissions(this, faltan.toArray(new String[0]), LOCATION_PERMISSION_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_CODE && webView != null) {
            webView.reload();
        }
    }

    // Funciones que la pagina puede llamar con window.DiaMonNativo
    private class PuenteNativo {
        @JavascriptInterface
        public void iniciarUbicacion() {
            runOnUiThread(() -> {
                // Desde Android 10 la ubicacion "todo el tiempo" se pide aparte (lleva a Ajustes)
                if (Build.VERSION.SDK_INT >= 29 && ContextCompat.checkSelfPermission(MainActivity.this,
                        Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, LOCATION_PERMISSION_CODE + 1);
                }
                // Primero se copia la sesion para que el servicio pueda guardar en Supabase
                sincronizarSesionSupabaseEnPrefs(webView);
                webView.postDelayed(() -> ContextCompat.startForegroundService(MainActivity.this,
                        new Intent(MainActivity.this, ServicioUbicacion.class)), 1500);
            });
        }

        @JavascriptInterface
        public void detenerUbicacion() {
            runOnUiThread(() -> stopService(new Intent(MainActivity.this, ServicioUbicacion.class)));
        }

        // Desde Configuracion > Registros sin conexion (la web no tiene botones nativos arriba)
        @JavascriptInterface
        public void abrirRegistrosSinConexion() {
            runOnUiThread(MainActivity.this::mostrarCrudClinico);
        }

        @JavascriptInterface
        public boolean ubicacionSiempre() {
            return Build.VERSION.SDK_INT < 29 || ContextCompat.checkSelfPermission(MainActivity.this,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
