package com.next.hostruntimern84

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Process
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.next.hostruntimern84.startup.LaunchOptionsFactory
import com.next.hostruntimern84.startup.ReactLifecycleGate
import com.next.hostruntimern84.startup.SecondaryProcessController
import com.next.hostruntimern84.startup.StartupAuditLogger
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 副屏 Activity。
 *
 * 它运行在独立进程 `:secondary` 中，用于承载第二套完全独立的 RN JS 运行时。
 * 这个类的设计重点不是业务 UI，而是进程级生命周期控制：
 * - 启动时向主进程回报“副屏已启动”；
 * - 接收主进程下发的重启/退出请求；
 * - 在受控关闭时发送 ACK；
 * - 最后主动结束本进程，确保后续启动时拿到全新的运行环境。
 */
open class SecondaryActivity : ReactActivity() {
  companion object {
    private const val TAG = "SecondaryActivity"
  }

  /**
   * 标记当前销毁是否由“受控重启”触发。
   *
   * 只有在收到主进程的 shutdown 广播后，这个标记才会被置为 true。这样 [onDestroy] 才知道
   * 需要发送 ACK 并 `killProcess`，避免普通系统销毁场景误伤。
   */
  private val shutdownRequested = AtomicBoolean(false)

  /**
   * 接收主进程发来的“请副屏退出”广播。
   *
   * 收到后不直接杀进程，而是先走 `finishAndRemoveTask()`，让 Activity 生命周期尽量完整结束，
   * 之后在 [onDestroy] 再发送 ACK 与退出进程。
   */
  private val restartReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (shutdownRequested.compareAndSet(false, true)) {
        StartupAuditLogger.logSecondaryShutdownRequested()
        finishAndRemoveTask()
      }
    }
  }

  /**
   * 与主屏共用同一个 RN 入口名，但因为 launch options 不同、进程不同，所以业务层可以区分
   * 主副屏上下文。
   */
  override fun getMainComponentName(): String = HostRuntimeConfig.mainComponentName

  /**
   * 创建副屏专用的启动参数，固定传 `displayIndex = 1`。
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = LaunchOptionsFactory.create(this@SecondaryActivity, 1)

      private val isReactContextReady: Boolean
        get() = reactHost?.currentReactContext != null

      override fun onNewIntent(intent: Intent?): Boolean {
        intent ?: return false
        if (!ReactLifecycleGate.shouldForwardToReact(isReactContextReady)) {
          this@SecondaryActivity.setIntent(intent)
          Log.d(TAG, "Skipped RN onNewIntent before React context is ready")
          return false
        }
        return super.onNewIntent(intent)
      }

      override fun onWindowFocusChanged(hasFocus: Boolean) {
        if (!ReactLifecycleGate.shouldForwardToReact(isReactContextReady)) {
          Log.d(
            TAG,
            "Skipped RN onWindowFocusChanged before React context is ready: hasFocus=$hasFocus",
          )
          return
        }
        super.onWindowFocusChanged(hasFocus)
      }
    }

  /**
   * 副屏创建入口。
   *
   * 这里主要完成三件事：
   * - 记录审计日志；
   * - 通知主进程“副屏已经起来了”；
   * - 注册重启广播接收器，等待后续受控退出。
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    StartupAuditLogger.logActivityCreated("SecondaryActivity", 1)
    SecondaryProcessController.markSecondaryStarted()
    sendBroadcast(SecondaryProcessController.createSecondaryStartedIntent(this))
    ContextCompat.registerReceiver(
      this,
      restartReceiver,
      SecondaryProcessController.createRestartRequestFilter(),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
  }

  /**
   * 副屏销毁时做受控收尾。
   *
   * 如果这是一次普通销毁，只做状态清理；
   * 如果这是重启链路中的受控销毁，则还要：
   * - 给主进程发 ACK；
   * - 写审计日志；
   * - 主动结束当前副进程，确保下次副屏启动拿到全新 JS 环境。
   */
  override fun onDestroy() {
    runCatching { unregisterReceiver(restartReceiver) }
    SecondaryProcessController.markSecondaryStopped()
    sendBroadcast(SecondaryProcessController.createSecondaryStoppedIntent(this))
    if (shutdownRequested.get()) {
      sendBroadcast(SecondaryProcessController.createRestartAckIntent(this))
      StartupAuditLogger.logSecondaryProcessExit()
      Process.killProcess(Process.myPid())
    }
    super.onDestroy()
  }
}
