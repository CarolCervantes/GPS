package co.diamon.salud.gps.infrastructure.di;

import android.app.Activity;
import android.content.Context;

import co.diamon.salud.gps.application.usecases.EmitirAlertaNativaUseCase;
import co.diamon.salud.gps.application.usecases.GestionarRegistroClinicoUseCase;
import co.diamon.salud.gps.domain.ports.NotificadorEmergenciaPort;
import co.diamon.salud.gps.domain.ports.RegistroClinicoRepositoryPort;
import co.diamon.salud.gps.domain.ports.WearableSensorPort;
import co.diamon.salud.gps.infrastructure.adapters.ble.WearableBleManager;
import co.diamon.salud.gps.infrastructure.adapters.notifications.NotificadorEmergenciaAndroid;
import co.diamon.salud.gps.infrastructure.adapters.sqlite.SqliteRegistroClinicoAdapter;
import co.diamon.salud.gps.infrastructure.adapters.supabase.SupabaseRestAdapter;

/**
 * Arquitectura Hexagonal - Composition Root (Contenedor de Inyección de Dependencias Android)
 * Ensambla todos los adaptadores de infraestructura (SQLite, Supabase, BLE, Notificaciones)
 * detrás de sus puertos de dominio para las Activities (Adaptadores de Entrada UI).
 */
public final class AndroidHexagonalContainer {

    private static final String SQLITE_DB_NAME = "diamon_clinico_v1";
    private static final int SQLITE_DB_VERSION = 1;

    private AndroidHexagonalContainer() {
    }

    public static GestionarRegistroClinicoUseCase crearCasoDeUsoRegistrosClinicos(Context context) throws Exception {
        RegistroClinicoRepositoryPort sqliteAdapter = new SqliteRegistroClinicoAdapter(context, SQLITE_DB_NAME, SQLITE_DB_VERSION);
        RegistroClinicoRepositoryPort supabaseAdapter = new SupabaseRestAdapter();
        return new GestionarRegistroClinicoUseCase(sqliteAdapter, supabaseAdapter);
    }

    public static EmitirAlertaNativaUseCase crearCasoDeUsoAlertasNativas(Context context) {
        NotificadorEmergenciaPort notificadorAdapter = new NotificadorEmergenciaAndroid(context);
        return new EmitirAlertaNativaUseCase(notificadorAdapter);
    }

    public static WearableSensorPort crearAdaptadorWearableBle(Activity activity, WearableSensorPort.Listener listener) {
        return new WearableBleManager(activity, listener);
    }
}
