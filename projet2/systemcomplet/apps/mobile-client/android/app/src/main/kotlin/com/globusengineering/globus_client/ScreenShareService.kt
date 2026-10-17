package com.globusengineering.globus_client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/** Service au premier plan pendant le partage d'écran (type « mediaProjection », obligatoire depuis Android 10). */
class ScreenShareService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "globus_screen_share"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(channelId, "Partage d'écran", NotificationManager.IMPORTANCE_LOW))
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, channelId) else @Suppress("DEPRECATION") Notification.Builder(this)
        val notification = builder
            .setContentTitle("Partage d'écran en cours")
            .setContentText("Votre écran est visible par les participants de l'appel.")
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(4242, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(4242, notification)
        }
        return START_NOT_STICKY
    }
}
