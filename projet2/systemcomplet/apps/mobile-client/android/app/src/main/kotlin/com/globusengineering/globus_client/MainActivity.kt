package com.globusengineering.globus_client

import android.content.Intent
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Activité principale : canal « globus/screen_share » démarrant le service au premier plan exigé par Android
 * avant toute projection de l'écran (partage d'écran pendant un appel WebRTC).
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "globus/screen_share").setMethodCallHandler { call, result ->
            val intent = Intent(this, ScreenShareService::class.java)
            when (call.method) {
                "start" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
                    result.success(null)
                }
                "stop" -> {
                    stopService(intent)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
