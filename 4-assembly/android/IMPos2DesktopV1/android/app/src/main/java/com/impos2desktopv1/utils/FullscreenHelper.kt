package com.impos2desktopv1.utils

import android.app.Activity
import android.os.Build
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager

/**
 * 全屏显示辅助工具类
 *
 * 功能：
 * 1. 统一管理全屏显示逻辑
 * 2. 兼容 Android 11+ 和旧版本 API
 * 3. 支持沉浸式全屏模式
 * 4. 可配置是否保持屏幕常亮
 */
object FullscreenHelper {

    private const val TAG = "FullscreenHelper"

    /**
     * 设置 Activity 为全屏模式
     *
     * @param activity 需要设置全屏的 Activity
     * @param keepScreenOn 是否保持屏幕常亮，默认为 true
     * @param immersive 是否使用沉浸式模式（滑动显示系统栏），默认为 true
     */
    fun setFullscreen(
        activity: Activity,
        keepScreenOn: Boolean = true,
        immersive: Boolean = true
    ) {
        try {
            Log.d(TAG, "========== 开始设置全屏 ==========")
            Log.d(TAG, "Activity: ${activity.javaClass.simpleName}")
            Log.d(TAG, "Android 版本: ${Build.VERSION.SDK_INT}")
            Log.d(TAG, "keepScreenOn: $keepScreenOn, immersive: $immersive")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11 (API 30) 及以上
                Log.d(TAG, "使用 Android 11+ API")
                setFullscreenForAndroid11Plus(activity, immersive)
            } else {
                // Android 11 以下
                Log.d(TAG, "使用旧版 API")
                setFullscreenForLegacy(activity, immersive)
            }

            // 设置屏幕常亮
            if (keepScreenOn) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                Log.d(TAG, "屏幕常亮已设置")
            }

            Log.d(TAG, "✅ 全屏模式设置成功")
        } catch (e: Exception) {
            Log.e(TAG, "❌ 设置全屏模式失败 - Activity: ${activity.javaClass.simpleName}", e)
        }
    }

    /**
     * Android 11+ 的全屏设置
     */
    private fun setFullscreenForAndroid11Plus(activity: Activity, immersive: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.window.setDecorFitsSystemWindows(false)
            activity.window.insetsController?.let { controller ->
                // 隐藏状态栏和导航栏
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())

                // 设置系统栏行为
                if (immersive) {
                    // 沉浸式模式：滑动才能显示系统栏
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                } else {
                    // 默认行为：触摸显示系统栏
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_DEFAULT
                }
            }
        }
    }

    /**
     * Android 11 以下的全屏设置
     */
    @Suppress("DEPRECATION")
    private fun setFullscreenForLegacy(activity: Activity, immersive: Boolean) {
        var flags = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        // 添加沉浸式标志
        if (immersive) {
            flags = flags or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }

        activity.window.decorView.systemUiVisibility = flags
    }

    /**
     * 清除屏幕常亮标志
     */
    fun clearKeepScreenOn(activity: Activity) {
        try {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            Log.d(TAG, "屏幕常亮已清除 - Activity: ${activity.javaClass.simpleName}")
        } catch (e: Exception) {
            Log.e(TAG, "清除屏幕常亮失败 - Activity: ${activity.javaClass.simpleName}", e)
        }
    }

    /**
     * 在 Activity 创建早期设置全屏（在 super.onCreate 之前调用）
     * 用于确保 SplashScreen 也能全屏显示
     */
    fun setFullscreenEarly(activity: Activity) {
        try {
            Log.d(TAG, "========== 设置早期全屏（SplashScreen 用）==========")

            // 设置 Window 标志
            activity.window.setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            )

            // 隐藏导航栏
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+
                activity.window.setDecorFitsSystemWindows(false)
            }

            Log.d(TAG, "✅ 早期全屏设置成功")
        } catch (e: Exception) {
            Log.e(TAG, "❌ 早期全屏设置失败", e)
        }
    }

    /**
     * 显示系统栏（退出全屏）
     */
    fun showSystemBars(activity: Activity) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                activity.window.insetsController?.show(
                    WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
                )
            } else {
                @Suppress("DEPRECATION")
                activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            }
            Log.d(TAG, "系统栏已显示 - Activity: ${activity.javaClass.simpleName}")
        } catch (e: Exception) {
            Log.e(TAG, "显示系统栏失败 - Activity: ${activity.javaClass.simpleName}", e)
        }
    }

    /**
     * 设置 SplashScreen Dialog 全屏
     * 必须在 SplashScreen.show() 之后立即调用
     */
    fun setSplashScreenFullscreen(activity: Activity) {
        try {
            Log.d(TAG, "========== 设置 SplashScreen Dialog 全屏 ==========")

            // 延迟一小段时间，确保 Dialog 已经创建
            activity.window.decorView.postDelayed({
                try {
                    // 获取所有 Window
                    val windowManager = activity.getSystemService(android.content.Context.WINDOW_SERVICE) as? android.view.WindowManager

                    // 再次设置 Activity Window 全屏
                    setFullscreen(activity)

                    Log.d(TAG, "✅ SplashScreen Dialog 全屏设置完成")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ 设置 SplashScreen Dialog 全屏失败", e)
                }
            }, 50) // 延迟 50ms

        } catch (e: Exception) {
            Log.e(TAG, "❌ 设置 SplashScreen Dialog 全屏失败", e)
        }
    }
}
