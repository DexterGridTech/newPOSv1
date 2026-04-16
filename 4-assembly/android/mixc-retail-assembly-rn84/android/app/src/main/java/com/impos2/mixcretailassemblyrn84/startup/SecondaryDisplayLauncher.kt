package com.impos2.mixcretailassemblyrn84.startup

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import com.impos2.mixcretailassemblyrn84.SecondaryActivity
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 副屏启动器。
 *
 * 它只关心“怎么把副屏 Activity 启到第二块屏幕上”，不关心“什么时候启动”。
 * 启动时机由 [StartupCoordinator] 控制，启动动作由这个类负责执行。
 */
class SecondaryDisplayLauncher(
  private val activity: Activity,
) {
  companion object {
    private const val TAG = "SecondaryDisplayLauncher"
  }

  /**
   * 记录当前是否已经发起过副屏启动请求，但副屏可能还没真正创建完成。
   *
   * 这个标记与 [SecondaryProcessController.isSecondaryAlive] 组合使用，可以避免在副屏还没完全拉起
   * 时重复发起第二次启动请求。
   */
  private val launchRequested = AtomicBoolean(false)

  /**
   * 副屏是否已经存在，或者正在启动过程中。
   */
  val isSecondaryActive: Boolean
    get() = SecondaryProcessController.isSecondaryAlive() || launchRequested.get()

  /**
   * 如果设备存在第二块屏幕，则尝试把 [SecondaryActivity] 启动到对应屏幕。
   *
   * 关键保护逻辑：
   * - 如果只有一块屏幕，直接返回；
   * - 如果已经有副屏实例，直接返回；
   * - 如果启动失败，回滚 `launchRequested`，允许后续再次尝试。
   */
  fun startIfAvailable() {
    val displayManager = activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    val displays = displayManager.displays
    if (displays.size < 2) {
      return
    }
    val secondary = displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY } ?: return
    if (isSecondaryActive) {
      return
    }

    Handler(Looper.getMainLooper()).post {
      runCatching {
        launchRequested.set(true)
        val intent = Intent(activity, SecondaryActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
        }
        val options = android.app.ActivityOptions.makeBasic().apply {
          launchDisplayId = secondary.displayId
        }
        activity.startActivity(intent, options.toBundle())
      }.onFailure {
        launchRequested.set(false)
        Log.e(TAG, "Failed to start SecondaryActivity", it)
      }
    }
  }

  /**
   * 副屏 Activity 已经成功创建，清掉“仅请求中”的状态。
   */
  fun markSecondaryStarted() {
    launchRequested.set(false)
  }

  /**
   * 副屏 Activity 已经退出，清掉启动标记，允许后续重新拉起。
   */
  fun markSecondaryStopped() {
    launchRequested.set(false)
  }

  /**
   * 在新一轮启动或重启前主动复位内部状态。
   */
  fun reset() {
    launchRequested.set(false)
  }
}
