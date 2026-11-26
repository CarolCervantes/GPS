package co.diamon.salud.gps;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

import co.diamon.salud.gps.infrastructure.adapters.supabase.SupabaseRestAdapter;

// Servicio que sigue enviando la ubicacion del paciente a Supabase aunque la pantalla este apagada
// o la app este en segundo plano. Android obliga a mostrar una notificacion fija mientras funciona.
public class ServicioUbicacion extends Service implements LocationListener {

    private static final String CANAL = "diamon_ubicacion";
    private static final long CADA_MS = 30000;      // cada 30 segundos
    // 0 metros: Android entrega la posicion aunque el celular este quieto (antes con 10 m casi no llegaban datos en casa)
    private static final float CADA_METROS = 0f;
    private static final String AUTH = "https://reghfwloifpfeehkfyxv.supabase.co/auth/v1";

    private LocationManager gps;
    private long ultimoEnvio = 0;
    private Location ultima;   // ultima posicion conocida
    private long ultimaBateria = 0;   // la bateria se manda cada minuto
    private static final long BATERIA_CADA_MS = 60000;

    // Latido: cada 30 s se envia la ultima posicion aunque Android no haya entregado una nueva
    private final Handler reloj = new Handler(Looper.getMainLooper());
    private final Runnable latido = new Runnable() {
        @Override
        public void run() {
            if (System.currentTimeMillis() - ultimoEnvio >= CADA_MS) {
                Location l = ultima != null ? ultima : ultimaDelSistema();
                if (l != null) enviarAhora(l);
            }
            reloj.postDelayed(this, CADA_MS);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        crearCanal();
        Intent abrir = new Intent(this, MainActivity.class);
        PendingIntent alTocar = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE);
        Notification aviso = new NotificationCompat.Builder(this, CANAL)
                .setContentTitle("DiaMon está compartiendo tu ubicación")
                .setContentText("Tu cuidador puede ver dónde estás para cuidarte.")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(alTocar)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, aviso, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(1, aviso);
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return START_NOT_STICKY;
        }
        gps = (LocationManager) getSystemService(LOCATION_SERVICE);
        // Si el servicio ya estaba corriendo no se duplican las peticiones
        gps.removeUpdates(this);
        reloj.removeCallbacks(latido);
        reloj.postDelayed(latido, CADA_MS);
        try {
            if (gps.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                gps.requestLocationUpdates(LocationManager.GPS_PROVIDER, CADA_MS, CADA_METROS, this);
            }
            if (gps.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                gps.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, CADA_MS, CADA_METROS, this);
            }
        } catch (SecurityException e) {
            stopSelf();
        }
        // Si Android cierra el servicio por falta de memoria, lo vuelve a abrir
        return START_STICKY;
    }

    @Override
    public void onLocationChanged(Location ubicacion) {
        ultima = ubicacion;
        if (System.currentTimeMillis() - ultimoEnvio < CADA_MS) return;
        enviarAhora(ubicacion);
    }

    private void enviarAhora(Location ubicacion) {
        ultimoEnvio = System.currentTimeMillis();
        final double lat = ubicacion.getLatitude();
        final double lng = ubicacion.getLongitude();
        new Thread(() -> enviar(lat, lng, true)).start();
    }

    private Location ultimaDelSistema() {
        try {
            Location l = gps.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            return l != null ? l : gps.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        } catch (SecurityException e) {
            return null;
        }
    }

    // Guarda la ubicacion en la tabla gps_lecturas con la sesion del paciente
    private void enviar(double lat, double lng, boolean reintentar) {
        SharedPreferences prefs = getSharedPreferences("diamon_supabase_auth", MODE_PRIVATE);
        String token = prefs.getString("access_token", null);
        String usuario = prefs.getString("user_id", null);
        if (token == null || usuario == null) return;
        try {
            JSONObject fila = new JSONObject();
            fila.put("user_id", usuario);
            fila.put("lat", lat);
            fila.put("lng", lng);
            int codigo = post(SupabaseRestAdapter.SUPABASE_URL + "/gps_lecturas", fila.toString(), token);
            if (codigo < 300 && System.currentTimeMillis() - ultimaBateria >= BATERIA_CADA_MS) {
                enviarBateria(usuario, token);
            }
            // 401 = la sesion vencio (dura 1 hora): se renueva con el refresh token y se reintenta una vez
            if (codigo == 401 && reintentar && renovarSesion(prefs)) {
                enviar(lat, lng, false);
            }
        } catch (Exception e) {
            Log.w("DiaMonGPS", "No se pudo enviar la ubicacion: " + e.getMessage());
        }
    }

    // La bateria va a la tabla registros (tipo "dispositivo"), que es donde la lee el panel del cuidador
    private void enviarBateria(String usuario, String token) {
        try {
            // Se le pregunta directo al servicio de bateria (el aviso "sticky" de Android 15 llegaba con datos viejos)
            BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);
            int nivel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            boolean cargando = bm.isCharging();
            if (nivel < 0 || nivel > 100) return;
            JSONObject notas = new JSONObject();
            notas.put("bateria", nivel);
            notas.put("cargando", cargando);
            JSONObject fila = new JSONObject();
            fila.put("user_id", usuario);
            fila.put("tipo", "dispositivo");
            fila.put("valor", "0");
            fila.put("notas", notas.toString());
            if (post(SupabaseRestAdapter.SUPABASE_URL + "/registros", fila.toString(), token) < 300) {
                ultimaBateria = System.currentTimeMillis();
            }
        } catch (Exception e) {
            Log.w("DiaMonGPS", "No se pudo enviar la bateria: " + e.getMessage());
        }
    }

    private boolean renovarSesion(SharedPreferences prefs) {
        String refresh = prefs.getString("refresh_token", null);
        if (refresh == null) return false;
        try {
            URL url = new URL(AUTH + "/token?grant_type=refresh_token");
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("POST");
            con.setRequestProperty("apikey", SupabaseRestAdapter.SUPABASE_ANON_KEY);
            con.setRequestProperty("Content-Type", "application/json");
            con.setDoOutput(true);
            try (OutputStream os = con.getOutputStream()) {
                os.write(new JSONObject().put("refresh_token", refresh).toString().getBytes(StandardCharsets.UTF_8));
            }
            if (con.getResponseCode() != 200) return false;
            String cuerpo;
            try (InputStream is = con.getInputStream(); Scanner sc = new Scanner(is, "UTF-8").useDelimiter("\\A")) {
                cuerpo = sc.hasNext() ? sc.next() : "";
            }
            JSONObject json = new JSONObject(cuerpo);
            prefs.edit()
                    .putString("access_token", json.getString("access_token"))
                    .putString("refresh_token", json.getString("refresh_token"))
                    .apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private int post(String direccion, String cuerpo, String token) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(direccion).openConnection();
        con.setRequestMethod("POST");
        con.setRequestProperty("apikey", SupabaseRestAdapter.SUPABASE_ANON_KEY);
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setRequestProperty("Content-Type", "application/json");
        con.setDoOutput(true);
        try (OutputStream os = con.getOutputStream()) {
            os.write(cuerpo.getBytes(StandardCharsets.UTF_8));
        }
        int codigo = con.getResponseCode();
        con.disconnect();
        return codigo;
    }

    private void crearCanal() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel canal = new NotificationChannel(CANAL, "Ubicación en segundo plano", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(canal);
        }
    }

    @Override
    public void onDestroy() {
        reloj.removeCallbacks(latido);
        if (gps != null) gps.removeUpdates(this);
        super.onDestroy();
    }

    @Override public void onStatusChanged(String p, int s, Bundle b) { }
    @Override public void onProviderEnabled(String p) { }
    @Override public void onProviderDisabled(String p) { }
    @Override public IBinder onBind(Intent intent) { return null; }
}
