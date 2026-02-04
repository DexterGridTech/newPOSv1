package com.impos2desktopv1

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import com.facebook.react.ReactInstanceManager
import com.impos2desktopv1.base.ActivityContext
import com.impos2desktopv1.base.BaseReactActivity
import com.impos2desktopv1.multidisplay.MultiDisplayManager
import com.impos2desktopv1.screen.ScreenControlManager

/**
 * 主 Activity
 *
 * 职责：
 * 1. 作为主屏的入口
 * 2. 管理应用初始化
 * 3. 提供管理器访问接口
 */
class MainActivity : BaseReactActivity(), ActivityContext {

    companion object {
        private const val TAG = "MainActivity"
    }

    private lateinit var appInitializer: AppInitializer
    private lateinit var appRestartManager: AppRestartManager

    override fun getMainComponentName(): String = "IMPos2DesktopV1"

    override fun getLaunchParams(): Bundle {
        return Bundle().apply {
            putString("screenType", "primary")
            putInt("displayId", 0)
            putString("displayName", "Primary Display")
        }
    }

    override fun onInitialize(savedInstanceState: Bundle?) {
        try {
            Log.d(TAG, "开始初始化主屏")

            // 初始化应用初始化器和重启管理器
            appInitializer = AppInitializer(this)
            appRestartManager = AppRestartManager(this)

            // 执行应用初始化
            appInitializer.initialize()

            Log.d(TAG, "主屏初始化完成")
        } catch (e: Exception) {
            Log.e(TAG, "主屏初始化失败", e)
        }
    }

    override fun onResumeAfterFullscreen() {
        // 强制隐藏状态栏
        appInitializer.screenControlManager?.enableFullscreen(force = true)

        // 调度多屏显示初始化
        appInitializer.scheduleMultiDisplayInit(reactNativeHost.reactInstanceManager)
    }

    override fun onNewIntent(intent: android.content.Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "从 LoadingActivity 返回")
        // LoadingActivity 已经显示了 SplashScreen，这里不需要再显示
    }

    override fun handleKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        // 尝试屏幕控制拦截
        return appInitializer.screenControlManager?.onKeyDown(keyCode, event) == true
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            appInitializer.destroy()
            Log.d(TAG, "应用资源已释放")
        } catch (e: Exception) {
            Log.e(TAG, "销毁资源失败", e)
        }
    }

    // ========== 公共接口（供 TurboModule 调用）==========

    fun getMultiDisplayManager(): MultiDisplayManager? {
        return appInitializer.multiDisplayManager
    }

    fun getScreenControlManager(): ScreenControlManager? {
        return appInitializer.screenControlManager
    }

    fun provideReactInstanceManager(): ReactInstanceManager {
        return reactNativeHost.reactInstanceManager
    }

    fun reloadReactApplication() {
        appRestartManager.reloadReactApplication()
    }

    // ========== ActivityContext 接口实现 ==========

    override fun getContext(): Context = this

    override fun getActivity(): Activity = this
}
