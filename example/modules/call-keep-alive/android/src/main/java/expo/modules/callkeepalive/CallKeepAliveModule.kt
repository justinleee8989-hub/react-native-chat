package expo.modules.callkeepalive

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallKeepAliveModule : Module() {
  // The headless JS task held open while the service runs: React Native pauses JS timers once the
  // app leaves the screen unless one is, and the call's heartbeats run on them.
  private var task = 0

  override fun definition() = ModuleDefinition {
    Name("CallKeepAlive")

    // Starts the call's foreground service, or updates its notification and the media it covers.
    // Android lets it start only while the app is in front; it returns whether it started.
    Function("start") { title: String, text: String, channel: String, camera: Boolean ->
      val context = appContext.reactContext ?: return@Function false
      val types = CallService.types(context, camera)
      val intent = Intent(context, CallService::class.java)
      if (types == 0) {
        stop()
        return@Function false
      }
      intent
        .putExtra(CallService.TITLE, title)
        .putExtra(CallService.TEXT, text)
        .putExtra(CallService.CHANNEL, channel)
        .putExtra(CallService.TYPES, types)
      try {
        ContextCompat.startForegroundService(context, intent)
      } catch (error: Exception) {
        stop()
        return@Function false
      }
      holdTimers()
      true
    }

    Function("stop") {
      stop()
    }

    OnDestroy {
      stop()
    }
  }

  private fun holdTimers() {
    val react = appContext.reactContext as? ReactContext ?: return
    UiThreadUtil.runOnUiThread {
      val tasks = HeadlessJsTaskContext.getInstance(react)
      if (task == 0 || !tasks.isTaskRunning(task))
        task = tasks.startTask(HeadlessJsTaskConfig(TASK, Arguments.createMap(), 0, true))
    }
  }

  private fun stop() {
    val context = appContext.reactContext ?: return
    context.stopService(Intent(context, CallService::class.java))
    val react = context as? ReactContext ?: return
    UiThreadUtil.runOnUiThread {
      if (task != 0)
        HeadlessJsTaskContext.getInstance(react).finishTask(task)
      task = 0
    }
  }

  companion object {
    const val TASK = "CallKeepAlive"
  }
}
