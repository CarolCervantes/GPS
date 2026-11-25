package co.diamon.salud.gps.infrastructure.adapters.supabase;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import co.diamon.salud.gps.domain.entities.RegistroClinico;
import co.diamon.salud.gps.domain.ports.RegistroClinicoRepositoryPort;

// Arquitectura Hexagonal - Adaptador de Infraestructura para Supabase (PostgreSQL en la nube)
// Sincroniza los registros de la app movil con la misma base de datos Supabase de la Web
public class SupabaseRestAdapter implements RegistroClinicoRepositoryPort {

    private static final String SUPABASE_URL = "https://reghfwloifpfeehkfyxv.supabase.co/rest/v1";
    private static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZ2hmd2xvaWZwZmVlaGtmeXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODMyMjIsImV4cCI6MjA5NTE1OTIyMn0.5ix9vsVT9PFTxm3LEFoau4N4cb4ZbUrvoKVAgW1iPOM";
    private final Context context;

    public SupabaseRestAdapter() {
        this.context = null;
    }

    public SupabaseRestAdapter(Context context) {
        this.context = context != null ? context.getApplicationContext() : null;
    }

    @Override
    public void agregarRegistro(final RegistroClinico reg) {
        String accessToken = null;
        String userId = null;
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences("diamon_supabase_auth", Context.MODE_PRIVATE);
            accessToken = prefs.getString("access_token", null);
            userId = prefs.getString("user_id", null);
        }
        final String bearerToken = (accessToken != null && !accessToken.isEmpty()) ? accessToken : SUPABASE_ANON_KEY;
        final String resolvedUserId = userId;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(SUPABASE_URL + "/registros");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                    conn.setRequestProperty("Authorization", "Bearer " + bearerToken);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setDoOutput(true);

                    JSONObject json = new JSONObject();
                    if (resolvedUserId != null && !resolvedUserId.isEmpty()) {
                        json.put("user_id", resolvedUserId);
                    }
                    json.put("tipo", "glucosa");
                    json.put("valor", reg.getGlucosa() + " | PA: " + reg.getPresion());
                    json.put("notas", reg.getPaciente() + " · Meds: " + reg.getMedicamento() + " · GPS: " + reg.getUbicacion());

                    byte[] bytes = json.toString().getBytes(StandardCharsets.UTF_8);
                    OutputStream os = conn.getOutputStream();
                    os.write(bytes);
                    os.flush();
                    os.close();
                    conn.getResponseCode();
                    conn.disconnect();
                } catch (Exception ignored) {
                }
            }
        }).start();
    }

    @Override
    public RegistroClinico consultarUnRegistro(String id) {
        return null;
    }

    @Override
    public void editarRegistro(final RegistroClinico reg) {
        agregarRegistro(reg);
    }

    @Override
    public void borrarRegistro(String id) {
    }

    @Override
    public int proximoId() {
        return 1;
    }
}
