package com.impos2.posdesktop.screen

import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager

class ScreenManager(
    private val activity: Activity,
    private val config: ScreenControlConfig
) {
    private var isFullscreenEnabled = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var restoreRunnable: Runnable? = null

    fun enableFullscreen() {
        try {
            activity.window.apply {
                if (config.keepScreenOn) addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    attributes = attributes.also {
                        it.layoutInDisplayCutoutMode =
                            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    }
                }
            }
            hideSystemBars()
            if (!isFullscreenEnabled && config.autoRestore && Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                @Suppress("DEPRECATION")
                activity.window.decorView.setOnSystemUiVisibilityChangeListener { visibility ->
                    if (isFullscreenEnabled && (visibility and View.SYSTEM_UI_FLAG_FULLSCREEN == 0)) {
                        scheduleRestore()
                    }
                }
            }
            isFullscreenEnabled = true
        } catch (_: Exception) {}
    }

    fun disableFullscreen() {
        if (!isFullscreenEnabled) return
        try {
            activity.window.clearFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                activity.window.insetsController?.show(
                    WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
                )
                activity.window.setDecorFitsSystemWindows(true)
            } else {
                @Suppress("DEPRECATION")
                activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
                activity.window.decorView.setOnSystemUiVisibilityChangeListener(null)
            }
            restoreRunnable?.let { mainHandler.removeCallbacks(it) }
            restoreRunnable = null
            isFullscreenEnabled = false
        } catch (_: Exception) {}
    }

    private fun hideSystemBars() {
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

    private fun scheduleRestore() {
        restoreRunnable?.let { mainHandler.removeCallbacks(it) }
        restoreRunnable = Runnable { if (isFullscreenEnabled) hideSystemBars() }.also {
            mainHandler.postDelayed(it, 500L)
        }
    }

    fun isFullscreen() = isFullscreenEnabled

    fun destroy() {
        restoreRunnable?.let { mainHandler.removeCallbacks(it) }
        restoreRunnable = null
    }
}
