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

/**
 * 应用级重启管理器。
 *
 * 这个类的职责是把“重启应用”从一个简单按钮动作，扩展成一条可控、可审计、可恢复的原生链路。
 * 当前设计遵循以下顺序：
 * 1. 记录审计日志并重置启动编排状态；
 * 2. 如果主进程 localWebServer 正在运行，则先停止；
 * 3. 如果副屏还在运行，则请求副进程有序退出并等待 ACK；
 * 4. 最后才 reload 主进程的 ReactHost，重建主屏 JS 运行时；
 * 5. 主屏再次 ready 后，再由启动编排器拉起新的副屏进程。
 *
 * 这样做的目的，是保证未来热更新场景中主副屏都能从干净环境重新加载最新 bundle。
 */
class AppRestartManager(private val activity: MainActivity) {

  /**
   * 所有重启编排都统一投递到主线程，避免与 Activity / ReactHost 生命周期交叉调用。
   */
  private val mainHandler = Handler(Looper.getMainLooper())

  /**
   * 主进程 local web server 管理器。
   *
   * 用户已经明确要求：重启前如果 web server 正在运行，必须先停掉，后续由 JS 层按自身时序
   * 再重新启动。
   */
  private val localWebServerManager by lazy { LocalWebServerManager.getInstance(activity.applicationContext) }

  companion object {
    private const val TAG = "AppRestartManager"

    /**
     * 等待 local web server 停止的最长时长。
     */
    private const val LOCAL_WEB_SERVER_STOP_TIMEOUT_MS = 3000L

    /**
     * 轮询 local web server 状态的间隔。
     */
    private const val LOCAL_WEB_SERVER_STOP_POLL_INTERVAL_MS = 100L
  }

  /**
   * 启动整条重启链路。
   */
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

  /**
   * 如果 local web server 正在运行，则先发起停止流程并等待它真正进入 STOPPED。
   *
   * 这里不会无脑 stop 一次后立刻继续，因为 server 可能还处于 STOPPING 过渡态。如果直接重载，
   * 下一轮 JS 又马上启动 server，容易出现端口占用、旧连接未清理等问题。
   */
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

  /**
   * 轮询等待 local web server 停止。
   *
   * 如果轮询异常，选择按“已停止”处理，避免把应用永久卡死在重启前。
   * 如果超时，也会放行重启，但会打 warning，方便后续通过日志回溯。
   */
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
