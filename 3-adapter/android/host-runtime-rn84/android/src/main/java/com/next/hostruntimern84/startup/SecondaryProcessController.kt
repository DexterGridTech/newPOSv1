package com.next.hostruntimern84.startup

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 主副进程之间的轻量级控制器。
 *
 * 它不直接持有 Activity，而是通过广播 + 原子状态的方式完成两件事情：
 * - 主进程请求副进程受控退出；
 * - 副进程退出时回传 ACK，让主进程知道可以继续 reload。
 *
 * 之所以不用更重的跨进程机制，是因为这里只需要一次性的控制信号，广播足够直接，依赖也更少。
 */
object SecondaryProcessController {

  private const val ACTION_RESTART_REQUEST = "com.next.hostruntimern84.action.SECONDARY_RESTART_REQUEST"
  private const val ACTION_RESTART_ACK = "com.next.hostruntimern84.action.SECONDARY_RESTART_ACK"
  private const val ACTION_SECONDARY_STARTED = "com.next.hostruntimern84.action.SECONDARY_STARTED"
  private const val ACTION_SECONDARY_STOPPED = "com.next.hostruntimern84.action.SECONDARY_STOPPED"
  private const val ACK_TIMEOUT_MS = 4000L

  /**
   * 记录当前进程内是否存在副屏实例。
   *
   * 注意：这是进程内状态，不是跨进程真相源。主进程和副进程会各自持有一份独立值，因此它只能用于
   * 副进程自身的本地判断，不能被主进程拿来判断“另一进程里的副屏是否仍然存活”。
   */
  private val secondaryAlive = AtomicBoolean(false)
  private val ackReceiverRef = java.util.concurrent.atomic.AtomicReference<BroadcastReceiver?>(null)

  private val mainHandler = Handler(Looper.getMainLooper())

  /**
   * 标记副进程已启动。
   */
  fun markSecondaryStarted() {
    secondaryAlive.set(true)
  }

  /**
   * 标记副进程已停止。
   */
  fun markSecondaryStopped() {
    secondaryAlive.set(false)
  }

  /**
   * 返回当前进程内是否仍被认为存在副屏实例。
   */
  fun isSecondaryAlive(): Boolean = secondaryAlive.get()

  /**
   * 构造副进程用于监听重启请求的过滤器。
   */
  fun createRestartRequestFilter(): IntentFilter = IntentFilter(ACTION_RESTART_REQUEST)

  /**
   * 构造副进程发给主进程的 ACK Intent。
   */
  fun createRestartAckIntent(context: Context): Intent = Intent(ACTION_RESTART_ACK).setPackage(context.packageName)

  fun createSecondaryStartedIntent(context: Context): Intent {
    return Intent(ACTION_SECONDARY_STARTED).setPackage(context.packageName)
  }

  fun createSecondaryStoppedIntent(context: Context): Intent {
    return Intent(ACTION_SECONDARY_STOPPED).setPackage(context.packageName)
  }

  fun createSecondaryStateFilter(): IntentFilter {
    return IntentFilter().apply {
      addAction(ACTION_SECONDARY_STARTED)
      addAction(ACTION_SECONDARY_STOPPED)
    }
  }

  fun isSecondaryStartedAction(intent: Intent?): Boolean {
    return intent?.action == ACTION_SECONDARY_STARTED
  }

  fun isSecondaryStoppedAction(intent: Intent?): Boolean {
    return intent?.action == ACTION_SECONDARY_STOPPED
  }

  /**
   * 如果当前存在副屏实例，则请求它优雅退出并等待 ACK；否则直接继续后续流程。
   *
   * `onComplete` 一定会被回调：
   * - 收到 ACK 时回调；
   * - 超时时回调；
   * - 根本没有副屏实例时也会直接回调。
   */
  fun requestShutdownIfNeeded(
    context: Context,
    hasSecondaryInstance: Boolean,
    onComplete: () -> Unit,
  ) {
    if (!hasSecondaryInstance) {
      onComplete()
      return
    }

    val applicationContext = context.applicationContext
    val completed = AtomicBoolean(false)
    clearAckReceiver(applicationContext)
    val timeoutRunnable = Runnable {
      if (completed.compareAndSet(false, true)) {
        StartupAuditLogger.logSecondaryShutdownTimeout()
        clearAckReceiver(applicationContext)
        onComplete()
      }
    }

    val ackReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (completed.compareAndSet(false, true)) {
          StartupAuditLogger.logSecondaryAckReceived()
          mainHandler.removeCallbacks(timeoutRunnable)
          markSecondaryStopped()
          clearAckReceiver(applicationContext)
          onComplete()
        }
      }
    }
    ackReceiverRef.set(ackReceiver)

    ContextCompat.registerReceiver(
      applicationContext,
      ackReceiver,
      IntentFilter(ACTION_RESTART_ACK),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )

    StartupAuditLogger.logSecondaryShutdownRequested()
    applicationContext.sendBroadcast(Intent(ACTION_RESTART_REQUEST).setPackage(applicationContext.packageName))
    mainHandler.postDelayed(timeoutRunnable, ACK_TIMEOUT_MS)
  }

  /**
   * 注销并清空当前注册的 ACK receiver。
   */
  private fun clearAckReceiver(context: Context) {
    ackReceiverRef.getAndSet(null)?.let { receiver ->
      runCatching { context.unregisterReceiver(receiver) }
    }
  }
}
