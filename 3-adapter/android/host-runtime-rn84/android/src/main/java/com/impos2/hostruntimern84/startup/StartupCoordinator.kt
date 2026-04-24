package com.impos2.hostruntimern84.startup

import android.os.Handler
import android.os.Looper
import com.impos2.adapterv2.hotupdate.HotUpdateBootMarkerStore
import com.impos2.hostruntimern84.MainActivity
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 启动阶段编排器。
 *
 * 这个对象把“显示启动遮罩、等待主屏 ready、何时关遮罩、何时启动副屏”从 Activity 中抽出来，
 * 让启动链路保持清晰。当前工程约定：
 * - 主屏 onAppLoadComplete(0) 后 1.5 秒关闭遮罩；
 * - 主屏 onAppLoadComplete(0) 后 3 秒启动副屏；
 * - 两者并行，不是串行。
 */
object StartupCoordinator {

  private enum class StartupMode {
    COLD_START,
    RESTART,
  }

  private const val OVERLAY_HIDE_DELAY_MS = 1500L
  private const val SECONDARY_START_DELAY_MS = 3000L

  /**
   * 主屏 JS 是否已经完成首轮加载。
   *
   * 这里只关心 displayIndex=0 的 ready 信号，避免副屏 ready 反向干扰主屏启动编排。
   */
  private val primaryReady = AtomicBoolean(false)
  private var startupMode: StartupMode = StartupMode.COLD_START

  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingOverlayHide: Runnable? = null
  private var pendingSecondaryStart: Runnable? = null
  private var pendingHealthCheckTimeout: Runnable? = null

  /**
   * 主屏 Activity 挂接时调用。
   *
   * 会重置状态、清理旧的延迟任务，并根据启动模式决定是否展示启动遮罩。
   *
   * - 冷启动：显示遮罩
   * - 重启：跳过遮罩，直接等待主屏 JS ready 后继续后续编排
   */
  fun attachPrimary(activity: MainActivity) {
    primaryReady.set(false)
    cancelPendingActions()
    scheduleHotUpdateHealthCheckIfNeeded(activity)
    if (startupMode == StartupMode.COLD_START) {
      StartupOverlayManager.show(activity)
    } else {
      StartupOverlayManager.hide()
    }
  }

  /**
   * 接收 JS 侧的“应用已加载完成”通知。
   *
   * 当前只有主屏 `displayIndex = 0` 会触发真正的启动后动作。副屏如果也调用此方法，只会留下日志，
   * 不会影响主屏编排状态。
   */
  fun onAppLoadComplete(activity: MainActivity, displayIndex: Int) {
    StartupAuditLogger.logLoadComplete(displayIndex)
    if (displayIndex != 0) {
      return
    }
    if (!primaryReady.compareAndSet(false, true)) {
      return
    }
    cancelHealthCheckTimeout("load-complete")
    scheduleOverlayHide()
    scheduleSecondaryStart(activity)
    startupMode = StartupMode.COLD_START
  }

  /**
   * 进入重启流程前调用。
   *
   * 会把启动协调器恢复到“等待主屏重新 ready”的初始状态，但不会重新展示启动遮罩。
   *
   * 用户要求只有首次启动显示 loading 遮罩，因此重启时这里仅切换模式并重置状态，让下一轮
   * `attachPrimary()` 跳过 overlay。
   */
  fun beginRestart(activity: MainActivity) {
    startupMode = StartupMode.RESTART
    primaryReady.set(false)
    cancelPendingActions()
    activity.resetSecondaryLaunchState()
    StartupOverlayManager.hide()
  }

  /**
   * 安排延迟关闭启动遮罩。
   */
  private fun scheduleOverlayHide() {
    if (startupMode == StartupMode.RESTART) {
      StartupOverlayManager.hide()
      return
    }
    pendingOverlayHide = Runnable {
      StartupOverlayManager.hide()
      pendingOverlayHide = null
    }.also {
      mainHandler.postDelayed(it, OVERLAY_HIDE_DELAY_MS)
    }
  }

  /**
   * 安排延迟启动副屏。
   */
  private fun scheduleSecondaryStart(activity: MainActivity) {
    StartupAuditLogger.logSecondaryLaunchScheduled()
    pendingSecondaryStart = Runnable {
      activity.launchSecondaryIfAvailable()
      pendingSecondaryStart = null
    }.also {
      mainHandler.postDelayed(it, SECONDARY_START_DELAY_MS)
    }
  }

  /**
   * 移除所有尚未执行的延迟任务。
   *
   * 这一步对重启很关键，否则上一轮启动遗留的 callback 可能在新一轮运行中误触发，造成副屏重复
   * 拉起或遮罩状态错乱。
   */
  private fun cancelPendingActions() {
    pendingOverlayHide?.let { mainHandler.removeCallbacks(it) }
    pendingOverlayHide = null
    pendingSecondaryStart?.let { mainHandler.removeCallbacks(it) }
    pendingSecondaryStart = null
    cancelHealthCheckTimeout("reset")
  }

  private fun scheduleHotUpdateHealthCheckIfNeeded(activity: MainActivity) {
    val marker = HotUpdateBootMarkerStore(activity.applicationContext).readBoot() ?: return
    val timeoutMs = marker.healthCheckTimeoutMs.coerceAtLeast(1L)
    StartupAuditLogger.logHotUpdateHealthCheckScheduled(
      timeoutMs = timeoutMs,
      bundleVersion = marker.bundleVersion,
      packageId = marker.packageId,
    )
    pendingHealthCheckTimeout = Runnable {
      pendingHealthCheckTimeout = null
      if (primaryReady.get()) {
        return@Runnable
      }
      StartupAuditLogger.logHotUpdateHealthCheckTimedOut(
        timeoutMs = timeoutMs,
        bundleVersion = marker.bundleVersion,
        packageId = marker.packageId,
      )
      HotUpdateBootMarkerStore(activity.applicationContext)
        .rollbackActive("HOT_UPDATE_HEALTH_CHECK_TIMEOUT")
      activity.restartApp()
    }.also {
      mainHandler.postDelayed(it, timeoutMs)
    }
  }

  private fun cancelHealthCheckTimeout(reason: String) {
    pendingHealthCheckTimeout?.let {
      mainHandler.removeCallbacks(it)
      StartupAuditLogger.logHotUpdateHealthCheckCancelled(reason)
    }
    pendingHealthCheckTimeout = null
  }
}
