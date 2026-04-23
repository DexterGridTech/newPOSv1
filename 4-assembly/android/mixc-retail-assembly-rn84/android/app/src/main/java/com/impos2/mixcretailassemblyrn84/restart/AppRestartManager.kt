package com.impos2.mixcretailassemblyrn84.restart

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3Manager
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3ServiceState
import com.impos2.mixcretailassemblyrn84.HotUpdateBundleResolver
import com.impos2.mixcretailassemblyrn84.MainActivity
import com.impos2.mixcretailassemblyrn84.MainApplication
import com.impos2.mixcretailassemblyrn84.startup.SecondaryProcessController
import com.impos2.mixcretailassemblyrn84.startup.StartupAuditLogger
import com.impos2.mixcretailassemblyrn84.startup.StartupCoordinator
import com.impos2.mixcretailassemblyrn84.startup.StartupOverlayManager
import com.impos2.mixcretailassemblyrn84.startup.TopologyLaunchCoordinator
import java.lang.ref.WeakReference

/**
 * 应用级重启管理器。
 *
 * 这个类的职责是把“重启应用”从一个简单按钮动作，扩展成一条可控、可审计、可恢复的原生链路。
 * 当前设计遵循以下顺序：
 * 1. 记录审计日志并重置启动编排状态；
 * 2. 如果主进程 topologyHost 正在运行，则先停止；
 * 3. 如果副屏还在运行，则请求副进程有序退出并等待 ACK；
 * 4. 在前台主屏中切换目标 JS bundle 并触发 ReactHost reload；
 * 5. 主屏再次 ready 后，再由启动编排器拉起新的副屏进程。
 *
 * Android 15 对后台启动 Activity 的限制更严格，传统“杀进程 + AlarmManager 拉起 Activity”
 * 方案在生产包下会被 BAL 拦截。这里改为在当前前台宿主内直接驱动 ReactHost reload：
 * - 热更新场景会从当前前台 Activity 重新拉起主入口并退出当前进程，让新进程在
 *   MainApplication.getJSBundleFile() 中按 active marker 构造全新的 ReactHost；
 * - 普通手动重启场景则直接 reload 当前 bundle source。
 *
 * 这样可以满足：
 * 1. 主副屏 JS runtime 被完整销毁重建；
 * 2. 热更新 bundle 立即生效；
 * 3. 启动编排、marker、版本上报链路保持不变。
 *
 * 注意：不能在生产包热更新里依赖 ReactHost.setBundleSource(filePath)。RN 0.84 的
 * setBundleSource 通过 DevSupportManager.bundleFilePath 传递路径，而 release 模式的
 * ReleaseDevSupportManager 对该属性是 no-op，最终 reload 仍会回到首次创建 host 时固定的
 * delegate bundle loader。
 */
class AppRestartManager(activity: MainActivity) {

  /**
   * 所有重启编排都统一投递到主线程，避免与 Activity / ReactHost 生命周期交叉调用。
   */
  private val mainHandler = Handler(Looper.getMainLooper())
  private val appContext = activity.applicationContext
  private val activityRef = WeakReference(activity)

  /**
   * 主进程 local web server 管理器。
   *
   * 用户已经明确要求：重启前如果 web server 正在运行，必须先停掉，后续由 JS 层按自身时序
   * 再重新启动。
   */
  private val topologyHostManager by lazy { TopologyHostV3Manager.getInstance(appContext) }

  companion object {
    private const val TAG = "AppRestartManager"

    /**
     * 等待 topology host 停止的最长时长。
     */
    private const val TOPOLOGY_HOST_STOP_TIMEOUT_MS = 3000L

    /**
     * 轮询 topology host 状态的间隔。
     */
    private const val TOPOLOGY_HOST_STOP_POLL_INTERVAL_MS = 100L

    internal fun normalizeHotUpdateBundleFile(bundleFile: String?): String? {
      return bundleFile?.takeIf { it.isNotBlank() }
    }

    internal fun shouldRelaunchProcessForHotUpdate(bundleFile: String?): Boolean {
      return normalizeHotUpdateBundleFile(bundleFile) != null
    }
  }

  /**
   * 启动整条重启链路。
   */
  fun restart() {
    if (activityRef.get() == null) {
      return
    }
    mainHandler.post {
      val currentActivity = activityRef.get() ?: return@post
      StartupAuditLogger.logRestartRequested(currentActivity.isSecondaryDisplayActive)
      StartupCoordinator.beginRestart(currentActivity)
      stopTopologyHostIfRunning {
        SecondaryProcessController.requestShutdownIfNeeded(
          context = currentActivity,
          hasSecondaryInstance = currentActivity.isSecondaryDisplayActive,
        ) {
          mainHandler.post {
            val delayedActivity = activityRef.get() ?: return@post
            try {
              reloadReactHost(delayedActivity)
            } catch (error: Throwable) {
              Log.e(TAG, "Failed to restart process", error)
              mainHandler.post {
                StartupOverlayManager.hide()
                val failedActivity = activityRef.get() ?: return@post
                Toast.makeText(failedActivity, "重启失败，请重试", Toast.LENGTH_LONG).show()
              }
            }
          }
        }
      }
    }
  }

  /**
   * 如果 topology host 正在运行，则先发起停止流程并等待它真正进入 STOPPED。
   *
   * 这里不会无脑 stop 一次后立刻继续，因为 server 可能还处于 STOPPING 过渡态。如果直接退出重启，
   * 下一轮 JS 又马上启动 server，容易出现端口占用、旧连接未清理等问题。
   */
  private fun stopTopologyHostIfRunning(onComplete: () -> Unit) {
    runCatching {
      val status = topologyHostManager.getStatus().state
      if (status == TopologyHostV3ServiceState.RUNNING || status == TopologyHostV3ServiceState.STARTING || status == TopologyHostV3ServiceState.STOPPING) {
        StartupAuditLogger.logTopologyHostStopping()
        topologyHostManager.stop()
        waitUntilTopologyHostStopped(onComplete)
      } else {
        onComplete()
      }
    }.onFailure {
      Log.w(TAG, "Failed to stop TopologyHost before restart", it)
      onComplete()
    }
  }

  /**
   * 轮询等待 topology host 停止。
   *
   * 如果轮询异常，选择按“已停止”处理，避免把应用永久卡死在重启前。
   * 如果超时，也会放行重启，但会打 warning，方便后续通过日志回溯。
   */
  private fun waitUntilTopologyHostStopped(onComplete: () -> Unit) {
    val deadline = System.currentTimeMillis() + TOPOLOGY_HOST_STOP_TIMEOUT_MS

    fun poll() {
      val stopped = runCatching {
        topologyHostManager.getStatus().state == TopologyHostV3ServiceState.STOPPED
      }.getOrElse {
        Log.w(TAG, "Failed to poll TopologyHost status", it)
        true
      }

      if (stopped) {
        TopologyLaunchCoordinator.clear(appContext)
        StartupAuditLogger.logTopologyHostStopped()
        onComplete()
        return
      }

      if (System.currentTimeMillis() >= deadline) {
        Log.w(TAG, "Timed out waiting for TopologyHost to stop")
        onComplete()
        return
      }

      mainHandler.postDelayed({ poll() }, TOPOLOGY_HOST_STOP_POLL_INTERVAL_MS)
    }

    poll()
  }

  private fun reloadReactHost(activity: MainActivity) {
    val application = activity.application as? MainApplication
      ?: error("MainApplication unavailable")
    val bundleFile = normalizeHotUpdateBundleFile(
      HotUpdateBundleResolver(appContext).peekActiveBundleFile(),
    )

    if (shouldRelaunchProcessForHotUpdate(bundleFile)) {
      StartupAuditLogger.logHotUpdateProcessRelaunchRequested(bundleFile!!)
      relaunchProcess(activity)
      return
    }

    StartupAuditLogger.logReactHostReloadRequested("manual-restart")
    application.reactHost.reload("manual-restart")
  }

  private fun relaunchProcess(activity: MainActivity) {
    val launchIntent = activity.packageManager.getLaunchIntentForPackage(activity.packageName)
      ?: error("Launch intent unavailable")
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    activity.startActivity(launchIntent)
    activity.finishAffinity()
    Log.i(TAG, "Exiting current process for hot update relaunch")
    Runtime.getRuntime().exit(0)
  }

  fun clear() {
    mainHandler.removeCallbacksAndMessages(null)
    activityRef.clear()
  }
}
