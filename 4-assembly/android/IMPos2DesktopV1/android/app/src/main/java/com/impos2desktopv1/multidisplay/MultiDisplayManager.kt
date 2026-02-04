package com.impos2desktopv1.multidisplay

import android.app.Activity
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactPackage
import com.facebook.react.common.LifecycleState
import com.impos2desktopv1.BuildConfig
import com.impos2.turbomodules.IMPos2TurboModulePackage
import com.reactnativemmkv.MmkvPackage

/**
 * 多屏显示管理器
 *
 * 功能：
 * 1. 延迟加载优化 - 动态检测主屏初始化状态
 * 2. Bundle预加载 - 确保有副屏时预加载
 * 3. 配置化管理 - 从配置文件读取参数
 * 4. 异常捕获 - 主副屏独立异常处理
 * 5. 重启功能 - 支持重启主屏和副屏的ReactInstanceManager
 */
class MultiDisplayManager(
    private val activity: Activity,
    private val mainReactInstanceManager: ReactInstanceManager
) {
    companion object {
        private const val TAG = "MultiDisplayManager"
        private const val SECONDARY_SCREEN_DELAY_MS = 3000L
    }

    private val config: MultiDisplayConfig = MultiDisplayConfig.loadFromAssets(activity)
    private val displayManager: DisplayManager by lazy {
        activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    }

    private var secondaryPresentation: SecondaryDisplayPresentation? = null
    private var secondaryReactInstanceManager: ReactInstanceManager? = null
    private var isInitialized = false
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * 初始化多屏显示
     * 主屏启动 3 秒后调用，直接初始化副屏
     */
    fun initialize() {
        if (!config.enabled) {
            Log.d(TAG, "多屏显示功能已禁用")
            return
        }

        if (isInitialized) {
            Log.d(TAG, "多屏显示已初始化，跳过")
            return
        }

        Log.d(TAG, "开始初始化多屏显示（主屏已启动完成）")
        initializeSecondaryDisplay()
    }

    /**
     * 初始化副屏显示
     */
    private fun initializeSecondaryDisplay() {
        try {
            val displays = displayManager.displays
            Log.d(TAG, "检测到的屏幕数量: ${displays.size}")

            // 打印所有屏幕信息
            displays.forEachIndexed { index, display ->
                Log.d(TAG, "屏幕[$index] - ID: ${display.displayId}, 名称: ${display.name}, " +
                        "尺寸: ${display.mode.physicalWidth}x${display.mode.physicalHeight}, " +
                        "有效: ${display.isValid}")
            }

            // 如果有两个或更多屏幕，为副屏创建Presentation
            if (displays.size >= 2) {
                val secondaryDisplay = displays.firstOrNull { it.displayId != 0 }

                if (secondaryDisplay == null) {
                    Log.w(TAG, "未找到副屏(所有屏幕的displayId都是0)")
                    return
                }

                Log.d(TAG, "准备为副屏创建Presentation - Display ID: ${secondaryDisplay.displayId}")

                // Bundle预加载：确保有副屏时预加载
                if (config.preloadBundle) {
                    preloadSecondaryBundle(secondaryDisplay)
                } else {
                    showSecondaryDisplay(secondaryDisplay)
                }

                isInitialized = true
            } else {
                Log.w(TAG, "未检测到副屏，当前只有 ${displays.size} 个屏幕")
            }
        } catch (e: Exception) {
            handleInitializationError(e)
        }
    }

    /**
     * Bundle预加载：创建独立的ReactInstanceManager
     */
    private fun preloadSecondaryBundle(secondaryDisplay: Display) {
        try {
            Log.d(TAG, "开始预加载副屏Bundle（独立的ReactInstanceManager）")
            secondaryReactInstanceManager = createSecondaryReactInstanceManager()

            // 延迟显示，确保Bundle加载完成
            mainHandler.postDelayed({
                showSecondaryDisplay(secondaryDisplay)
            }, config.initDelayMs)
        } catch (e: Exception) {
            Log.e(TAG, "预加载副屏Bundle失败", e)
            if (config.errorHandling.fallbackToSingleScreen) {
                Log.w(TAG, "降级为单屏模式")
            }
        }
    }

    /**
     * 显示副屏
     */
    private fun showSecondaryDisplay(secondaryDisplay: Display) {
        try {
            val reactInstanceManager = secondaryReactInstanceManager
                ?: createSecondaryReactInstanceManager()

            secondaryPresentation = SecondaryDisplayPresentation(
                activity,
                secondaryDisplay,
                reactInstanceManager,
                config
            )
            secondaryPresentation?.show()

            Log.d(TAG, "副屏Presentation已显示")
        } catch (e: Exception) {
            handleSecondaryDisplayError(e)
        }
    }

    /**
     * 创建副屏的独立ReactInstanceManager
     * 与主屏使用相同的JS Bundle
     */
    private fun createSecondaryReactInstanceManager(): ReactInstanceManager {
        Log.d(TAG, "创建副屏的ReactInstanceManager")

        val packages = mutableListOf<ReactPackage>()
        packages.add(com.facebook.react.shell.MainReactPackage())
        packages.add(IMPos2TurboModulePackage())
        packages.add(MmkvPackage())
        packages.add(MultiDisplayTurboModulePackage())

        val builder = ReactInstanceManager.builder()
            .setApplication(activity.application)
            .setCurrentActivity(activity)
            .addPackages(packages)
            .setUseDeveloperSupport(BuildConfig.DEBUG)
            .setInitialLifecycleState(LifecycleState.RESUMED)

        // 使用与主屏相同的Bundle
        if (BuildConfig.DEBUG) {
            builder.setJSMainModulePath("index")
        } else {
            builder.setBundleAssetName("index.android.bundle")
        }

        return builder.build()
    }

    /**
     * 重启副屏
     */
    private fun restartSecondaryScreen() {
        if (!config.enabled) {
            Log.d(TAG, "多屏显示功能已禁用，跳过副屏重启")
            return
        }

        try {
            Log.d(TAG, "开始重启副屏...")
            destroySecondaryScreen()
            isInitialized = false

            // 延迟后重新初始化副屏
            mainHandler.postDelayed({
                initializeSecondaryDisplay()
                Log.d(TAG, "副屏重启完成")
            }, SECONDARY_SCREEN_DELAY_MS)
        } catch (e: Exception) {
            Log.e(TAG, "重启副屏失败", e)
        }
    }

    /**
     * 处理初始化错误
     */
    private fun handleInitializationError(e: Exception) {
        Log.e(TAG, "初始化多屏显示失败", e)
        if (config.errorHandling.fallbackToSingleScreen) {
            Log.w(TAG, "降级为单屏模式")
        }
    }

    /**
     * 处理副屏显示错误
     */
    private fun handleSecondaryDisplayError(e: Exception) {
        if (config.errorHandling.catchSecondaryScreenErrors) {
            Log.e(TAG, "副屏显示失败，但不影响主屏运行", e)
            if (config.errorHandling.fallbackToSingleScreen) {
                Log.w(TAG, "降级为单屏模式")
            }
        } else {
            throw e
        }
    }

    /**
     * 重启应用（主屏+副屏）
     * 通过中间页避免退回桌面
     *
     * @param onMainScreenRestart 主屏重启回调，由 MainActivity 实现跳转到 LoadingActivity
     */
    fun restartApplication(onMainScreenRestart: () -> Unit) {
        Log.d(TAG, "开始重启应用（主屏+副屏）...")

        mainHandler.post {
            try {
                // 1. 先销毁副屏
                destroySecondaryScreen()

                // 2. 通知 MainActivity 跳转到中间页并重启主屏
                onMainScreenRestart.invoke()

                // 3. 延迟重启副屏
                restartSecondaryScreen()

                Log.d(TAG, "应用重启流程已启动")
            } catch (e: Exception) {
                Log.e(TAG, "重启应用失败", e)
            }
        }
    }

    /**
     * 销毁副屏资源
     */
    private fun destroySecondaryScreen() {
        try {
            secondaryPresentation?.dismiss()
            secondaryPresentation = null
            secondaryReactInstanceManager?.destroy()
            secondaryReactInstanceManager = null
            Log.d(TAG, "副屏资源已释放")
        } catch (e: Exception) {
            Log.e(TAG, "销毁副屏资源失败", e)
        }
    }

    /**
     * 销毁所有资源
     */
    fun destroy() {
        destroySecondaryScreen()
    }

    /**
     * 获取副屏状态
     */
    fun isSecondaryDisplayActive(): Boolean {
        return secondaryPresentation?.isShowing == true
    }

    /**
     * 获取主屏ReactInstanceManager
     */
    fun getMainReactInstanceManager(): ReactInstanceManager {
        return mainReactInstanceManager
    }
}
