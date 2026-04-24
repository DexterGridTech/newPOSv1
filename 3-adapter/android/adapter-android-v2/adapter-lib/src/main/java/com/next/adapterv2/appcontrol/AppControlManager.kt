package com.next.adapterv2.appcontrol

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import java.lang.ref.WeakReference

/**
 * 宿主应用控制管理器。
 *
 * 这个类封装的是“和 Android 宿主界面/任务栈直接相关”的能力，例如：
 * - 全屏；
 * - 锁定任务；
 * - 加载态占位；
 * - 宿主页面退出或状态重放。
 *
 * 这些能力都具有很强的平台语义，不能散落在各个调用点里临时拼装，所以统一收口到这里。
 */
class AppControlManager private constructor(private val application: Application) :
  Application.ActivityLifecycleCallbacks {

  companion object {
    @Volatile
    private var instance: AppControlManager? = null

    fun getInstance(application: Application): AppControlManager {
      return instance ?: synchronized(this) {
        instance ?: AppControlManager(application).also { instance = it }
      }
    }
  }

  // 大部分系统 UI 操作都要求在主线程执行，因此统一通过主线程 handler 调度。
  private val mainHandler = Handler(Looper.getMainLooper())
  private var currentActivityRef: WeakReference<Activity>? = null
  private var loadingDialogActivityRef: WeakReference<Activity>? = null
  private var loadingDialog: AlertDialog? = null
  @Volatile
  private var fullscreenEnabled = false
  @Volatile
  private var kioskEnabled = false
  private var restoreRunnable: Runnable? = null

  init {
    application.registerActivityLifecycleCallbacks(this)
  }

  fun isFullscreen(): Boolean = fullscreenEnabled

  fun isKioskMode(): Boolean {
    val activity = currentActivityRef?.get() ?: return kioskEnabled
    val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    } else {
      @Suppress("DEPRECATION")
      am.isInLockTaskMode
    }
  }

  fun showLoading(message: String) {
    mainHandler.post {
      val activity = currentActivityRef?.get() ?: return@post
      loadingDialog?.dismiss()
      loadingDialog = AlertDialog.Builder(activity)
        .setMessage(message)
        .setCancelable(false)
        .create()
      loadingDialogActivityRef = WeakReference(activity)
      loadingDialog?.show()
    }
  }

  fun hideLoading(displayIndex: Int = 0) {
    mainHandler.post {
      loadingDialog?.dismiss()
      loadingDialog = null
      loadingDialogActivityRef = null
    }
  }

  fun restartApp() {
    mainHandler.post {
      val activity = currentActivityRef?.get() ?: return@post
      val launchIntent = activity.packageManager.getLaunchIntentForPackage(activity.packageName) ?: return@post
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      activity.startActivity(launchIntent)
      activity.finishAffinity()
      Runtime.getRuntime().exit(0)
    }
  }

  fun exitApp() {
    mainHandler.post {
      currentActivityRef?.get()?.finishAffinity()
    }
  }

  fun setFullscreen(enabled: Boolean) {
    fullscreenEnabled = enabled
    mainHandler.post {
      currentActivityRef?.get()?.let {
        if (enabled) {
          enableFullscreen(it)
        } else {
          disableFullscreen(it)
        }
      }
    }
  }

  fun setKioskMode(enabled: Boolean) {
    kioskEnabled = enabled
    mainHandler.post {
      currentActivityRef?.get()?.let {
        if (enabled) {
          runCatching { it.startLockTask() }
        } else {
          runCatching { it.stopLockTask() }
        }
      }
    }
  }

  fun reapplyCurrentState() {
    mainHandler.post {
      val activity = currentActivityRef?.get() ?: return@post
      if (fullscreenEnabled) {
        enableFullscreen(activity)
      }
      if (kioskEnabled) {
        runCatching { activity.startLockTask() }
      }
    }
  }

  private fun enableFullscreen(activity: Activity) {
    val decorView = activity.window?.decorView ?: return
    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      activity.window.attributes = activity.window.attributes.also {
        it.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
    }
    decorView.post {
      runCatching { hideSystemBars(activity) }
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      @Suppress("DEPRECATION")
      decorView.setOnSystemUiVisibilityChangeListener { visibility ->
        if (fullscreenEnabled && (visibility and View.SYSTEM_UI_FLAG_FULLSCREEN == 0)) {
          scheduleRestore(activity)
        }
      }
    }
  }

  private fun disableFullscreen(activity: Activity) {
    activity.window.clearFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_FULLSCREEN,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.window.insetsController?.show(
        WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars(),
      )
      activity.window.setDecorFitsSystemWindows(true)
    } else {
      @Suppress("DEPRECATION")
      activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
      activity.window.decorView.setOnSystemUiVisibilityChangeListener(null)
    }
    restoreRunnable?.let { mainHandler.removeCallbacks(it) }
    restoreRunnable = null
  }

  private fun hideSystemBars(activity: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.window.setDecorFitsSystemWindows(false)
      activity.window.insetsController?.let {
        it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    } else {
      @Suppress("DEPRECATION")
      activity.window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
          View.SYSTEM_UI_FLAG_FULLSCREEN or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      )
    }
  }

  private fun scheduleRestore(activity: Activity) {
    restoreRunnable?.let { mainHandler.removeCallbacks(it) }
    restoreRunnable = Runnable {
      if (fullscreenEnabled) {
        hideSystemBars(activity)
      }
    }.also {
      mainHandler.postDelayed(it, 500L)
    }
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: android.os.Bundle?) {
    currentActivityRef = WeakReference(activity)
    if (fullscreenEnabled) {
      runCatching { enableFullscreen(activity) }
    }
    if (kioskEnabled) {
      runCatching { activity.startLockTask() }
    }
  }

  override fun onActivityStarted(activity: Activity) {
    currentActivityRef = WeakReference(activity)
    if (fullscreenEnabled) {
      runCatching { enableFullscreen(activity) }
    }
    if (kioskEnabled) {
      runCatching { activity.startLockTask() }
    }
  }

  override fun onActivityResumed(activity: Activity) {
    currentActivityRef = WeakReference(activity)
    if (fullscreenEnabled) {
      runCatching { enableFullscreen(activity) }
    }
    if (kioskEnabled) {
      runCatching { activity.startLockTask() }
    }
  }

  override fun onActivityPaused(activity: Activity) = Unit

  override fun onActivityStopped(activity: Activity) = Unit

  override fun onActivitySaveInstanceState(activity: Activity, outState: android.os.Bundle) = Unit

  override fun onActivityDestroyed(activity: Activity) {
    if (loadingDialogActivityRef?.get() === activity) {
      loadingDialog?.dismiss()
      loadingDialog = null
      loadingDialogActivityRef = null
    }
    if (currentActivityRef?.get() === activity) {
      currentActivityRef = null
    }
  }
}
