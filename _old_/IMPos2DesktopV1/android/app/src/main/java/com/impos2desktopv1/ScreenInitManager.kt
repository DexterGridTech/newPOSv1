package com.impos2desktopv1

import android.content.Context
import android.hardware.display.DisplayManager
import android.util.Log
import org.devio.rn.splashscreen.SplashScreen

/**
 * 屏幕初始化状态管理器
 *
 * 职责：
 * 1. 跟踪主屏的初始化状态
 * 2. 当主屏初始化完成后，隐藏 SplashScreen
 * 3. 检测副屏硬件并启动副屏
 * 4. 管理全屏恢复任务的生命周期
 */
object ScreenInitManager {

    private const val TAG = "ScreenInitManager"

    // 配置项：全屏恢复的延迟时间序列（单位：毫秒）
    private val FULLSCREEN_RESTORE_DELAYS = longArrayOf(100L, 500L, 1000L)

    private var primaryScreenInitialized = false
    private var secondaryScreenInitialized = false
    private var mainActivity: MainActivity? = null

    // 用于管理延迟任务，防止内存泄漏
    private val pendingRunnables = mutableListOf<Runnable>()

    // 副屏启动器
    private var secondaryScreenLauncher: SecondaryScreenLauncher? = null
    
    /**
     * 设置 MainActivity 引用
     */
    fun setMainActivity(activity: MainActivity) {
        mainActivity = activity
        // 初始化副屏启动器
        secondaryScreenLauncher = SecondaryScreenLauncher(activity, activity)
        Log.d(TAG, "MainActivity 已设置")
    }
    
    /**
     * 通知主屏初始化完成
     * 主屏初始化完成后：
     * 1. 隐藏 SplashScreen
     * 2. 检测副屏硬件
     * 3. 如果有副屏，则启动副屏
     */
    fun notifyPrimaryScreenInitialized(props: Map<String, Any>) {
        Log.d(TAG, "主屏初始化完成，props: $props")
        primaryScreenInitialized = true
        checkAndHideSplashScreen()

        // 检测并启动副屏
        checkAndStartSecondaryScreen()
    }
    
    /**
     * 通知副屏初始化完成
     */
    fun notifySecondaryScreenInitialized(props: Map<String, Any>) {
        Log.d(TAG, "副屏初始化完成，props: $props")
        secondaryScreenInitialized = true
        checkAndHideSplashScreen()
    }
    
    /**
     * 检查主屏是否初始化完成，如果是则隐藏 SplashScreen
     */
    private fun checkAndHideSplashScreen() {
        if (!primaryScreenInitialized) {
            Log.d(TAG, "等待主屏初始化完成")
            return
        }

        Log.d(TAG, "主屏初始化完成，隐藏 SplashScreen")
        mainActivity?.runOnUiThread {
            try {
                SplashScreen.hide(mainActivity)
                Log.d(TAG, "SplashScreen 已隐藏")

                // 调度多次全屏恢复任务
                scheduleFullscreenRestore()
            } catch (e: Exception) {
                Log.e(TAG, "隐藏 SplashScreen 失败", e)
            }
        }
    }

    /**
     * 检测并启动副屏
     * 在主屏初始化完成后调用
     */
    private fun checkAndStartSecondaryScreen() {
        try {
            Log.d(TAG, "开始检测副屏硬件...")
            secondaryScreenLauncher?.launchSecondaryScreen()
        } catch (e: Exception) {
            Log.e(TAG, "检测或启动副屏失败", e)
        }
    }

    /**
     * 调度多次全屏恢复任务
     * 使用配置化的延迟时间序列，确保 React Native 渲染后仍保持全屏
     */
    private fun scheduleFullscreenRestore() {
        val activity = mainActivity ?: return

        FULLSCREEN_RESTORE_DELAYS.forEachIndexed { index, delay ->
            val runnable = Runnable {
                try {
                    Log.d(TAG, "全屏恢复 - 第${index + 1}次")
                    com.impos2desktopv1.utils.FullscreenHelper.setFullscreen(activity)
                } catch (e: Exception) {
                    Log.e(TAG, "第${index + 1}次全屏恢复失败", e)
                }
            }

            activity.window.decorView.postDelayed(runnable, delay)
            pendingRunnables.add(runnable)
        }
    }

    /**
     * 取消所有待执行的全屏恢复任务
     * 防止内存泄漏
     */
    private fun cancelPendingFullscreenRestore() {
        mainActivity?.window?.decorView?.let { decorView ->
            pendingRunnables.forEach { runnable ->
                decorView.removeCallbacks(runnable)
            }
        }
        pendingRunnables.clear()
    }
    
    /**
     * 重置状态（用于应用重启）
     * 清理所有资源，防止内存泄漏
     */
    fun reset() {
        Log.d(TAG, "重置初始化状态")
        cancelPendingFullscreenRestore()
        primaryScreenInitialized = false
        secondaryScreenInitialized = false
        secondaryScreenLauncher = null
        mainActivity = null
    }
}
