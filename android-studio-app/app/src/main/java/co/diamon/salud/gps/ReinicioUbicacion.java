package co.diamon.salud.gps;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

// Vuelve a encender el envio de ubicacion cuando el celular se reinicia o cuando se actualiza la app,
// sin que el paciente tenga que abrir DiaMon. Solo si ya inicio sesion y dio el permiso de ubicacion.
public class ReinicioUbicacion extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexto, Intent intento) {
        String accion = intento.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(accion) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(accion)) return;

        boolean hayPermiso = ContextCompat.checkSelfPermission(contexto, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean todoElTiempo = Build.VERSION.SDK_INT < 29 || ContextCompat.checkSelfPermission(contexto,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean conSesion = contexto.getSharedPreferences("diamon_supabase_auth", Context.MODE_PRIVATE)
                .getString("access_token", null) != null;

        if (hayPermiso && todoElTiempo && conSesion) {
            ContextCompat.startForegroundService(contexto, new Intent(contexto, ServicioUbicacion.class));
        }
    }
}
