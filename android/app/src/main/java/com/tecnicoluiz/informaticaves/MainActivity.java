package com.tecnicoluiz.informaticaves;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // ── Canal de ALTA prioridad para nuevas solicitudes ─────────────
    // IMPORTANCE_HIGH = aparece como heads-up (banner en pantalla),
    // reproduce el sonido del sistema y vibra.
    private static final String CHANNEL_SOLICITUDES_ID   = "ives_solicitudes_high";
    private static final String CHANNEL_SOLICITUDES_NAME = "Nuevas Solicitudes";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        crearCanalNotificaciones();
    }

    private void crearCanalNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // ── Canal de ALTA prioridad (solicitudes) ──────────────
            if (nm.getNotificationChannel(CHANNEL_SOLICITUDES_ID) == null) {
                NotificationChannel canal = new NotificationChannel(
                    CHANNEL_SOLICITUDES_ID,
                    CHANNEL_SOLICITUDES_NAME,
                    NotificationManager.IMPORTANCE_HIGH  // Heads-up, sonido, vibración
                );
                canal.setDescription("Notificaciones de nuevas solicitudes de clientes");
                canal.enableVibration(true);
                canal.setVibrationPattern(new long[]{0, 300, 150, 300, 150, 300});
                canal.enableLights(true);
                canal.setShowBadge(true);

                // Usar sonido de notificación del sistema
                AudioAttributes audioAtts = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                canal.setSound(
                    android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
                    audioAtts
                );

                nm.createNotificationChannel(canal);
            }
        }
    }
}
