package co.diamon.salud.gps.infrastructure.adapters.notifications;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import co.diamon.salud.gps.MainActivity;
import co.diamon.salud.gps.R;
import co.diamon.salud.gps.domain.ports.NotificadorEmergenciaPort;

/**
 * DiaMon — Adaptador Nativo de Notificaciones y Vibración de Emergencia 24/7 en Android
 * Implementa el puerto de dominio NotificadorEmergenciaPort.
 */
public class NotificadorEmergenciaAndroid implements NotificadorEmergenciaPort {

    public static final String CANAL_EMERGENCIAS = "diamon_emergencias_247";
    public static final String CANAL_CLINICO = "diamon_clinico_info";

    private final Context context;
    private final NotificationManager notificationManager;
    private int nextNotificationId = 3000;

    public NotificadorEmergenciaAndroid(Context context) {
        this.context = context.getApplicationContext();
        this.notificationManager = (NotificationManager) this.context.getSystemService(Context.NOTIFICATION_SERVICE);
        crearCanales();
    }

    private void crearCanales() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager == null) return;

        NotificationChannel canalUrgente = new NotificationChannel(
                CANAL_EMERGENCIAS,
                "Alertas Críticas y SOS 24/7",
                NotificationManager.IMPORTANCE_HIGH
        );
        canalUrgente.setDescription("Alarmas de hipoglucemia/hiperglucemia preventiva, geocerca y SOS Modo Abuelo.");
        canalUrgente.enableVibration(true);
        canalUrgente.setVibrationPattern(new long[]{0, 450, 180, 450, 180, 650});
        canalUrgente.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(canalUrgente);

        NotificationChannel canalInfo = new NotificationChannel(
                CANAL_CLINICO,
                "Seguimiento Clínico DiaMon",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        canalInfo.setDescription("Confirmaciones de medicamentos, bienestar diario y estado del wearable.");
        notificationManager.createNotificationChannel(canalInfo);
    }

    public void mostrarNotificacion(String titulo, String mensaje, boolean esCritica) {
        if (notificationManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        String canal = esCritica ? CANAL_EMERGENCIAS : CANAL_CLINICO;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, canal)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(titulo != null && !titulo.isEmpty() ? titulo : "DiaMon Alerta 24/7")
                .setContentText(mensaje != null ? mensaje : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(mensaje != null ? mensaje : ""))
                .setPriority(esCritica ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(esCritica ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_STATUS)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        if (esCritica) {
            builder.setVibrate(new long[]{0, 450, 180, 450, 180, 650});
        }

        notificationManager.notify(nextNotificationId++, builder.build());
    }

    public void vibrar(boolean esCritica) {
        try {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator == null || !vibrator.hasVibrator()) return;

            long[] patron = esCritica
                    ? new long[]{0, 400, 150, 400, 150, 600}
                    : new long[]{0, 180};

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(patron, -1));
            } else {
                vibrator.vibrate(patron, -1);
            }
        } catch (Exception ignored) {
        }
    }
}
