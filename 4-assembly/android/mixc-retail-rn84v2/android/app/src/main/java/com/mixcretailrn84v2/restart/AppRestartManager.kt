package com.impos2.mixcretailrn84v2.restart

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import com.impos2.adapter.interfaces.LocalWebServerStatus
import com.impos2.adapter.webserver.LocalWebServerManager
import com.impos2.mixcretailrn84v2.MainActivity
import com.impos2.mixcretailrn84v2.startup.SecondaryProcessController
import com.impos2.mixcretailrn84v2.startup.StartupAuditLogger
import com.impos2.mixcretailrn84v2.startup.StartupCoordinator
import com.impos2.mixcretailrn84v2.startup.StartupOverlayManager

class AppRestartManager(private val activity: MainActivity) {

  private val mainHandler = Handler(Looper.getMainLooper())
  private val localWebServerManager by lazy { LocalWebServerManager.getInstance(activity.applicationContext) }

  companion object {
    private const val TAG = "AppRestartManager"
    private const val LOCAL_WEB_SERVER_STOP_TIMEOUT_MS = 3000L
    private const val LOCAL_WEB_SERVER_STOP_POLL_INTERVAL_MS = 100L
  }

  fun restart() {
    mainHandler.post {
      StartupAuditLogger.logRestartRequested(activity.isSecondaryDisplayActive)
      StartupCoordinator.beginRestart(activity)
      stopLocalWebServerIfRunning {
        SecondaryProcessController.requestShutdownIfNeeded(
          context = activity,
          hasSecondaryInstance = activity.isSecondaryDisplayActive,
        ) {
          mainHandler.postDelayed({
            try {
              activity.reloadReactHostForRestart()
            } catch (error: Throwable) {
              Log.e(TAG, "Failed to reload ReactHost", error)
              mainHandler.post {
                StartupOverlayManager.hide()
                Toast.makeText(activity, "重启失败，请重试", Toast.LENGTH_LONG).show()
              }
            }
          }, 100)
        }
      }
    }
  }

  private fun stopLocalWebServerIfRunning(onComplete: () -> Unit) {
    runCatching {
      val status = localWebServerManager.getStatus().status
      if (status == LocalWebServerStatus.RUNNING || status == LocalWebServerStatus.STARTING || status == LocalWebServerStatus.STOPPING) {
        StartupAuditLogger.logLocalWebServerStopping()
        localWebServerManager.stop()
        waitUntilLocalWebServerStopped(onComplete)
      } else {
        onComplete()
      }
    }.onFailure {
      Log.w(TAG, "Failed to stop LocalWebServer before restart", it)
      onComplete()
    }
  }

  private fun waitUntilLocalWebServerStopped(onComplete: () -> Unit) {
    val deadline = System.currentTimeMillis() + LOCAL_WEB_SERVER_STOP_TIMEOUT_MS

    fun poll() {
      val stopped = runCatching {
        localWebServerManager.getStatus().status == LocalWebServerStatus.STOPPED
      }.getOrElse {
        Log.w(TAG, "Failed to poll LocalWebServer status", it)
        true
      }

      if (stopped) {
        StartupAuditLogger.logLocalWebServerStopped()
        onComplete()
        return
      }

      if (System.currentTimeMillis() >= deadline) {
        Log.w(TAG, "Timed out waiting for LocalWebServer to stop")
        onComplete()
        return
      }

      mainHandler.postDelayed({ poll() }, LOCAL_WEB_SERVER_STOP_POLL_INTERVAL_MS)
    }

    poll()
  }
}
