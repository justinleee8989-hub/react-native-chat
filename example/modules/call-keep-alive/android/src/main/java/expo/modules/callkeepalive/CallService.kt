package expo.modules.callkeepalive

import android.Manifest
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

// Keeps a call's microphone, camera and connection running while the app is in the background,
// with an ongoing notification that brings the call back.
class CallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val types = intent?.getIntExtra(TYPES, 0) ?: 0
    if (types == 0) {
      stopSelf()
      return START_NOT_STICKY
    }
    NotificationManagerCompat.from(this).createNotificationChannel(
      NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
        .setName(intent?.getStringExtra(CHANNEL) ?: "")
        .setShowBadge(false)
        .build()
    )
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.call_keep_alive_notification)
      .setContentTitle(intent?.getStringExtra(TITLE))
      .setContentText(intent?.getStringExtra(TEXT))
      .setContentIntent(open)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, types)
    } catch (error: Exception) {
      // A permission withdrawn since the call started, or the app sent to the background first.
      stopSelf()
    }
    return START_NOT_STICKY
  }

  companion object {
    const val TITLE = "title"
    const val TEXT = "text"
    const val CHANNEL = "channel"
    const val TYPES = "types"
    private const val CHANNEL_ID = "call"
    private const val NOTIFICATION_ID = 7001

    // The media the service may keep running: Android refuses one the app has no permission for.
    fun types(context: Context, camera: Boolean): Int {
      fun granted(permission: String) =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
      var types = 0
      if (granted(Manifest.permission.RECORD_AUDIO))
        types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      if (camera && granted(Manifest.permission.CAMERA))
        types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
      return types
    }
  }
}
