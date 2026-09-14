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

    // ── Canales de Notificación y Alarma ──────────────────────────
    private static final String CHANNEL_SOLICITUDES_ID   = "ives_solicitudes_high";
    private static final String CHANNEL_SOLICITUDES_NAME = "🚨 Alarmas de Nuevas Solicitudes";
    private static final String CHANNEL_STATUS_ID        = "ives_status_updates";
    private static final String CHANNEL_STATUS_NAME      = "🔔 Cambios de Estado y Asignaciones";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        crearCanalesNotificaciones();
    }

    private void crearCanalesNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // ── Canal 1: ALARMA DE NUEVAS SOLICITUDES (Alarma acústica + vibración intensa) ──
            NotificationChannel canalAlarma = new NotificationChannel(
                CHANNEL_SOLICITUDES_ID,
                CHANNEL_SOLICITUDES_NAME,
                NotificationManager.IMPORTANCE_HIGH  // Banner heads-up, sonido, vibración
            );
            canalAlarma.setDescription("Alarma inmediata y sonora cuando un cliente solicita asistencia técnica");
            canalAlarma.enableVibration(true);
            canalAlarma.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500, 200, 800});
            canalAlarma.enableLights(true);
            canalAlarma.setShowBadge(true);

            AudioAttributes audioAttsAlarma = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            canalAlarma.setSound(
                android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI != null ?
                    android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI :
                    android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
                audioAttsAlarma
            );
            nm.createNotificationChannel(canalAlarma);

            // ── Canal 2: ACTUALIZACIONES DE ESTADO (Tomado, En camino, Finalizado) ──
            NotificationChannel canalStatus = new NotificationChannel(
                CHANNEL_STATUS_ID,
                CHANNEL_STATUS_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            canalStatus.setDescription("Alertas al tomar casos, traslados y actualizaciones en tiempo real");
            canalStatus.enableVibration(true);
            canalStatus.setVibrationPattern(new long[]{0, 250, 100, 250});
            canalStatus.enableLights(true);
            canalStatus.setShowBadge(true);

            AudioAttributes audioAttsStatus = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            canalStatus.setSound(
                android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
                audioAttsStatus
            );
            nm.createNotificationChannel(canalStatus);
        }
    }
}
