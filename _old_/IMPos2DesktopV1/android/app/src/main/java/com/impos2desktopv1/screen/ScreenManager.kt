package com.impos2desktopv1.screen

import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * 全屏模式管理器
 *
 * 功能：
 * 1. 隐藏状态栏和导航栏（支持 Android 5.0+）
 * 2. 沉浸式全屏模式（IMMERSIVE_STICKY）
 * 3. 自动恢复全屏（监听系统UI变化）
 * 4. 刘海屏适配（Android P+）
 * 5. 保持屏幕常亮
 *
 * 优化点：
 * - 使用 WindowInsetsControllerCompat 兼容库，统一处理不同 Android 版本
 * - 延迟恢复机制，避免频繁触发
 * - 配置化管理，支持动态开关
 */
class ScreenManager(
    private val activity: Activity,
    private val config: ScreenControlConfig
) {
    companion object {
        private const val TAG = "ScreenManager"
        private const val RESTORE_DELAY_MS = 500L
    }

    private var isFullscreenEnabled = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private val windowInsetsController: WindowInsetsControllerCompat
    private var restoreRunnable: Runnable? = null

    init {
        windowInsetsController = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
    }

    /**
     * 启用全屏模式
     * @param force 是否强制重新应用（用于 onResume/onWindowFocusChanged）
     */
    fun enableFullscreen(force: Boolean = false) {
        if (isFullscreenEnabled && !force) {
            Log.d(TAG, "全屏模式已启用，跳过")
            return
        }

        Log.d(TAG, "启用全屏模式${if (force) "（强制）" else ""}...")

        try {
            // 1. 设置窗口标志（仅首次）
            if (!isFullscreenEnabled) {
                setupWindowFlags()
            }

            // 2. 配置窗口布局（仅首次）
            if (!isFullscreenEnabled) {
                setupWindowLayout()
            }

            // 3. 刘海屏适配（仅首次）
            if (!isFullscreenEnabled) {
                setupDisplayCutout()
            }

            // 4. 隐藏系统栏（每次都执行，确保状态栏被隐藏）
            hideSystemBars()

            // 5. 设置自动恢复监听（仅首次）
            if (!isFullscreenEnabled && config.autoRestore) {
                setupAutoRestore()
            }

            isFullscreenEnabled = true
            Log.d(TAG, "✅ 全屏模式已启用")
        } catch (e: Exception) {
            Log.e(TAG, "启用全屏模式失败", e)
        }
    }

    /**
     * 禁用全屏模式
     */
    fun disableFullscreen() {
        if (!isFullscreenEnabled) {
            Log.d(TAG, "全屏模式未启用，跳过")
            return
        }

        Log.d(TAG, "禁用全屏模式...")

        try {
            // 移除窗口标志
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)

            // 恢复系统栏
            showSystemBars()

            // 移除监听器
            removeAutoRestore()

            isFullscreenEnabled = false
            Log.d(TAG, "✅ 全屏模式已禁用")
        } catch (e: Exception) {
            Log.e(TAG, "禁用全屏模式失败", e)
        }
    }

    /**
     * 设置窗口标志
     */
    private fun setupWindowFlags() {
        activity.window.apply {
            // 保持屏幕常亮
            if (config.keepScreenOn) {
                addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                Log.d(TAG, "屏幕常亮已启用")
            }

            // 全屏标志 - 隐藏状态栏
            addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)

            // 允许内容绘制到屏幕边缘
            addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)

            // 强制隐藏状态栏和导航栏
            addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN)

            // 设置为不可触摸的系统覆盖层
            addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)
            clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)
        }
    }

    /**
     * 配置窗口布局
     */
    private fun setupWindowLayout() {
        // 让内容绘制到系统栏下方
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        Log.d(TAG, "窗口布局已配置")
    }

    /**
     * 刘海屏适配（Android P+）
     */
    private fun setupDisplayCutout() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            activity.window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            Log.d(TAG, "刘海屏适配已启用")
        }
    }

    /**
     * 隐藏系统栏（状态栏 + 导航栏）
     */
    private fun hideSystemBars() {
        // Android 11+ 使用新 API
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.window.insetsController?.let { controller ->
                // 隐藏状态栏和导航栏
                controller.hide(
                    WindowInsets.Type.statusBars() or
                    WindowInsets.Type.navigationBars() or
                    WindowInsets.Type.systemBars()
                )
                // 设置为沉浸式模式 - 用户交互后自动隐藏
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                Log.d(TAG, "系统栏已隐藏（Android 11+ API）")
            }

            // 额外设置：强制隐藏状态栏内容
            activity.window.setDecorFitsSystemWindows(false)
        } else {
            // Android 11 以下使用传统方式
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LOW_PROFILE
            )
            Log.d(TAG, "系统栏已隐藏（传统 API）")
        }

        // 使用兼容库确保所有版本都生效
        windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
        windowInsetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    /**
     * 显示系统栏
     */
    private fun showSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.window.insetsController?.show(
                WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
            )
        } else {
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }

        windowInsetsController.show(WindowInsetsCompat.Type.systemBars())
        Log.d(TAG, "系统栏已显示")
    }

    /**
     * 设置自动恢复全屏监听
     */
    @Suppress("DEPRECATION")
    private fun setupAutoRestore() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // Android 11 以下使用 setOnSystemUiVisibilityChangeListener
            activity.window.decorView.setOnSystemUiVisibilityChangeListener { visibility ->
                if (isFullscreenEnabled && (visibility and View.SYSTEM_UI_FLAG_FULLSCREEN == 0)) {
                    // 检测到系统UI显示，延迟恢复全屏
                    scheduleRestore()
                }
            }
            Log.d(TAG, "自动恢复监听已设置（传统 API）")
        } else {
            // Android 11+ 使用 WindowInsetsController 的监听
            // 注意：新 API 没有直接的监听器，需要通过其他方式实现
            // 这里我们依赖 BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE 的自动隐藏行为
            Log.d(TAG, "自动恢复监听已设置（Android 11+ 依赖系统行为）")
        }
    }

    /**
     * 移除自动恢复监听
     */
    @Suppress("DEPRECATION")
    private fun removeAutoRestore() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            activity.window.decorView.setOnSystemUiVisibilityChangeListener(null)
        }
        restoreRunnable?.let { mainHandler.removeCallbacks(it) }
        restoreRunnable = null
    }

    /**
     * 延迟恢复全屏
     */
    private fun scheduleRestore() {
        // 取消之前的恢复任务
        restoreRunnable?.let { mainHandler.removeCallbacks(it) }

        // 创建新的恢复任务
        restoreRunnable = Runnable {
            if (isFullscreenEnabled) {
                Log.d(TAG, "自动恢复全屏...")
                hideSystemBars()
            }
        }

        // 延迟执行
        mainHandler.postDelayed(restoreRunnable!!, RESTORE_DELAY_MS)
    }

    /**
     * 获取全屏状态
     */
    fun isFullscreen(): Boolean = isFullscreenEnabled

    /**
     * 清理资源
     */
    fun destroy() {
        removeAutoRestore()
        if (isFullscreenEnabled) {
            disableFullscreen()
        }
    }
}
