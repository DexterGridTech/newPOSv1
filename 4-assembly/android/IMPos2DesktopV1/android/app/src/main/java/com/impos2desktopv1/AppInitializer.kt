package com.impos2desktopv1

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.ReactInstanceManager
import com.impos2desktopv1.multidisplay.MultiDisplayConfig
import com.impos2desktopv1.multidisplay.MultiDisplayManager
import com.impos2desktopv1.screen.ScreenControlConfig
import com.impos2desktopv1.screen.ScreenControlManager

/**
 * 应用初始化器
 *
 * 职责：
 * 1. 初始化屏幕控制
 * 2. 调度多屏显示初始化
 * 3. 管理初始化状态
 */
class AppInitializer(private val activity: MainActivity) {

    companion object {
        private const val TAG = "AppInitializer"
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isMultiDisplayInitialized = false
    private var multiDisplayConfig: MultiDisplayConfig? = null

    var screenControlManager: ScreenControlManager? = null
        private set

    var multiDisplayManager: MultiDisplayManager? = null
        private set

    /**
     * 初始化应用
     */
    fun initialize() {
        try {
            Log.d(TAG, "开始初始化应用...")

            // 1. 加载多屏配置
            multiDisplayConfig = MultiDisplayConfig.loadFromAssets(activity)

            // 2. 初始化屏幕控制
            initializeScreenControl()

            Log.d(TAG, "应用初始化完成")
        } catch (e: Exception) {
            Log.e(TAG, "应用初始化失败", e)
        }
    }

    /**
     * 调度多屏显示初始化（在 onResume 时调用）
     */
    fun scheduleMultiDisplayInit(reactInstanceManager: ReactInstanceManager) {
        // 只在首次且配置启用时初始化
        if (!isMultiDisplayInitialized && shouldInitMultiDisplay()) {
            val delayMs = getInitDelayFromConfig()
            Log.d(TAG, "将在 ${delayMs}ms 后初始化多屏显示")
            mainHandler.postDelayed({
                initializeMultiDisplay(reactInstanceManager)
                isMultiDisplayInitialized = true
            }, delayMs)
        }
    }

    /**
     * 初始化屏幕控制
     */
    private fun initializeScreenControl() {
        try {
            val config = ScreenControlConfig.loadFromAssets(activity)
            screenControlManager = ScreenControlManager(activity, config)
            screenControlManager?.initialize()
            Log.d(TAG, "屏幕控制管理器已初始化")
        } catch (e: Exception) {
            Log.e(TAG, "初始化屏幕控制失败", e)
        }
    }

    /**
     * 初始化多屏显示
     */
    private fun initializeMultiDisplay(reactInstanceManager: ReactInstanceManager) {
        try {
            if (multiDisplayManager == null) {
                multiDisplayManager = MultiDisplayManager(activity, reactInstanceManager)
                multiDisplayManager?.initialize()
                Log.d(TAG, "多屏显示管理器已初始化")
            }
        } catch (e: Exception) {
            Log.e(TAG, "初始化多屏显示失败", e)
        }
    }

    /**
     * 判断是否应该初始化多屏显示
     */
    private fun shouldInitMultiDisplay(): Boolean {
        return multiDisplayConfig?.enabled == true
    }

    /**
     * 从配置获取初始化延迟时间
     */
    private fun getInitDelayFromConfig(): Long {
        return multiDisplayConfig?.initDelayMs ?: 3000L
    }

    /**
     * 清理资源
     */
    fun destroy() {
        try {
            multiDisplayManager?.destroy()
            multiDisplayManager = null
            screenControlManager?.destroy()
            screenControlManager = null
            Log.d(TAG, "应用资源已释放")
        } catch (e: Exception) {
            Log.e(TAG, "清理资源失败", e)
        }
    }
}
