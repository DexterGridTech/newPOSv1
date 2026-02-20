package com.impos2desktopv1

import android.content.Context
import android.hardware.display.DisplayManager
import android.util.Log
import com.facebook.react.ReactInstanceManager

/**
 * 副屏启动器
 *
 * 职责：
 * 1. 检测副屏硬件是否连接
 * 2. 在主屏初始化完成后启动副屏
 * 3. 提供副屏启动的统一入口
 *
 * 设计原则：
 * - 单一职责：只负责副屏的检测和启动
 * - 依赖注入：通过构造函数注入依赖
 */
class SecondaryScreenLauncher(
    private val context: Context,
    private val mainActivity: MainActivity
) {
    companion object {
        private const val TAG = "SecondaryScreenLauncher"
    }

    private val displayManager: DisplayManager by lazy {
        context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    }

    /**
     * 检测副屏硬件是否连接
     * @return true 表示有副屏连接，false 表示没有副屏
     */
    fun hasSecondaryDisplay(): Boolean {
        return try {
            val displays = displayManager.displays
            Log.d(TAG, "检测到的屏幕数量: ${displays.size}")

            // 打印所有屏幕信息
            displays.forEachIndexed { index, display ->
                Log.d(TAG, "屏幕[$index] - ID: ${display.displayId}, 名称: ${display.name}, " +
                        "尺寸: ${display.mode.physicalWidth}x${display.mode.physicalHeight}, " +
                        "有效: ${display.isValid}")
            }

            // 检查是否有副屏（displayId != 0）
            val hasSecondary = displays.size >= 2 && displays.any { it.displayId != 0 }
            Log.d(TAG, "副屏检测结果: $hasSecondary")
            hasSecondary
        } catch (e: Exception) {
            Log.e(TAG, "检测副屏失败", e)
            false
        }
    }

    /**
     * 启动副屏
     * 前提条件：主屏已经初始化完成
     */
    fun launchSecondaryScreen() {
        try {
            Log.d(TAG, "开始启动副屏...")

            // 检测副屏硬件
            if (!hasSecondaryDisplay()) {
                Log.w(TAG, "未检测到副屏硬件，取消启动")
                return
            }

            // 确保 MultiDisplayManager 已初始化
            var multiDisplayManager = mainActivity.getMultiDisplayManager()
            if (multiDisplayManager == null) {
                Log.w(TAG, "MultiDisplayManager 未初始化，先初始化管理器")
                val reactInstanceManager = mainActivity.provideReactInstanceManager()
                mainActivity.initializeMultiDisplayManager(reactInstanceManager)

                // 重新获取初始化后的实例
                multiDisplayManager = mainActivity.getMultiDisplayManager()
                if (multiDisplayManager == null) {
                    Log.e(TAG, "MultiDisplayManager 初始化失败，无法启动副屏")
                    return
                }
            }

            // 启动副屏
            multiDisplayManager.startSecondaryScreen()
            Log.d(TAG, "副屏启动请求已发送")
        } catch (e: Exception) {
            Log.e(TAG, "启动副屏失败", e)
        }
    }
}
