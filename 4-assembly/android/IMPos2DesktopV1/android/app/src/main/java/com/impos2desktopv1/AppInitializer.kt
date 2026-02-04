package com.impos2desktopv1

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.ReactInstanceManager
import com.impos2desktopv1.base.ActivityContext
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
 *
 * 设计原则：
 * - 依赖倒置：依赖 ActivityContext 接口而非具体 Activity
 * - 单一职责：只负责初始化逻辑
 */
class AppInitializer(private val activityContext: ActivityContext) {

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
            multiDisplayConfig = MultiDisplayConfig.loadFromAssets(activityContext.getContext())

            // 2. 初始化屏幕控制
            initializeScreenControl()

            Log.d(TAG, "应用初始化完成")
        } catch (e: Exception) {
            Log.e(TAG, "应用初始化失败", e)
        }
    }

    /**
     * 调度多屏显示初始化
     */
    fun scheduleMultiDisplayInit(reactInstanceManager: ReactInstanceManager) {
        // 使用 synchronized 确保线程安全
        synchronized(this) {
            if (isMultiDisplayInitialized) {
                Log.d(TAG, "多屏显示已初始化或已调度，跳过")
                return
            }

            if (!shouldInitMultiDisplay()) {
                Log.d(TAG, "多屏显示功能未启用，跳过")
                return
            }

            // 立即标记为已初始化，避免重复调度
            isMultiDisplayInitialized = true

            val delayMs = getInitDelayFromConfig()
            Log.d(TAG, "将在 ${delayMs}ms 后初始化多屏显示")
            mainHandler.postDelayed({
                initializeMultiDisplay(reactInstanceManager)
            }, delayMs)
        }
    }

    /**
     * 初始化屏幕控制
     */
    private fun initializeScreenControl() {
        try {
            val config = ScreenControlConfig.loadFromAssets(activityContext.getContext())
            screenControlManager = ScreenControlManager(activityContext.getActivity(), config)
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
                multiDisplayManager = MultiDisplayManager(
                    activityContext.getActivity(),
                    reactInstanceManager
                )
                multiDisplayManager?.initialize()
                Log.d(TAG, "多屏显示管理器已初始化")
            }
        } catch (e: Exception) {
            Log.e(TAG, "初始化多屏显示失败", e)
        }
    }

    private fun shouldInitMultiDisplay(): Boolean {
        return multiDisplayConfig?.enabled == true
    }

    private fun getInitDelayFromConfig(): Long {
        return multiDisplayConfig?.initDelayMs ?: 3000L
    }

    /**
     * 清理资源
     */
    fun destroy() {
        try {
            mainHandler.removeCallbacksAndMessages(null)
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
