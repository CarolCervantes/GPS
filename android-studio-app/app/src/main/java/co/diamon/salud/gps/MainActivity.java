package co.diamon.salud.gps;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.GeolocationPermissions;
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
import org.json.JSONObject;
import org.json.JSONTokener;

// Actividad principal de DiaMon GPS
// Inicia en la pantalla de Login / Registro (sin modo invitado bloqueado)
// y permite abrir la actividad nativa CRUD SQLite (ActividadCrudClinico)
public class MainActivity extends AppCompatActivity {

    private static final int LOCATION_PERMISSION_CODE = 1001;
    private static final String DIAMON_LOGIN_URL = "file:///android_asset/pages/login.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webViewDiaMon);
        solicitarPermisosUbicacion();

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

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";

                if ("javascript".equalsIgnoreCase(scheme)) {
                    return true;
                }
                if ("tel".equals(scheme) || "mailto".equals(scheme) || host.contains("wa.me") || host.contains("maps.google.com")) {
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
        });

        // Al abrir la app por primera vez carga Login / Registro
        webView.loadUrl(DIAMON_LOGIN_URL);
    }

    // abre la actividad nativa de CRUD SQLite (Guardar, Buscar, Limpiar, Modificar, Eliminar)
    public void mostrarCrudClinico(View component) {
        Intent intento = new Intent(this, ActividadCrudClinico.class);
        startActivity(intento);
    }

    // lleva directamente a la pantalla de Login y Registro
    public void irALogin(View component) {
        if (webView != null) {
            webView.loadUrl(DIAMON_LOGIN_URL);
        }
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
                + "return JSON.stringify({access_token:s.access_token,user_id:(s.user&&s.user.id)||''});"
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

                    SharedPreferences prefs = getSharedPreferences("diamon_supabase_auth", MODE_PRIVATE);
                    SharedPreferences.Editor editor = prefs.edit();
                    if (!token.isEmpty() && !userId.isEmpty()) {
                        editor.putString("access_token", token);
                        editor.putString("user_id", userId);
                    } else {
                        editor.remove("access_token");
                        editor.remove("user_id");
                    }
                    editor.apply();
                } catch (Exception ignored) {
                }
            }
        });
    }

    private void solicitarPermisosUbicacion() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_CODE
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_CODE && webView != null) {
            webView.reload();
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
