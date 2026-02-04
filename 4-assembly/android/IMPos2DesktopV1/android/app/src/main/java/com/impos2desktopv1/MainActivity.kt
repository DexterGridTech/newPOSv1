package com.impos2desktopv1

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2desktopv1.multidisplay.MultiDisplayManager
import com.impos2desktopv1.screen.ScreenControlManager
import com.impos2desktopv1.utils.FullscreenHelper
import org.devio.rn.splashscreen.SplashScreen

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
  }

  private lateinit var appInitializer: AppInitializer
  private lateinit var appRestartManager: AppRestartManager

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "IMPos2DesktopV1"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun getLaunchOptions(): Bundle? {
          // 传递初始化参数，标识这是主屏
          return Bundle().apply {
            putString("screenType", "primary")
            putInt("displayId", 0)
            putString("displayName", "Primary Display")
          }
        }
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    // 在 super.onCreate 之前设置早期全屏（确保 SplashScreen 也全屏）
    FullscreenHelper.setFullscreenEarly(this)

    try {
      super.onCreate(savedInstanceState)
      Log.d(TAG, "MainActivity onCreate")

      // 在 super.onCreate 之后再次设置完整的全屏模式
      FullscreenHelper.setFullscreen(this)

      // 显示启动屏
      SplashScreen.show(this)

      // 设置 SplashScreen Dialog 全屏
      FullscreenHelper.setSplashScreenFullscreen(this)

      // 初始化应用初始化器和重启管理器
      appInitializer = AppInitializer(this)
      appRestartManager = AppRestartManager(this)

      // 执行应用初始化
      appInitializer.initialize()
    } catch (e: Exception) {
      Log.e(TAG, "主屏初始化失败", e)
    }
  }

  override fun onResume() {
    super.onResume()
    Log.d(TAG, "MainActivity onResume")

    // 强制隐藏状态栏（force = true）
    appInitializer.screenControlManager?.enableFullscreen(force = true)

    // 调度多屏显示初始化
    appInitializer.scheduleMultiDisplayInit(reactNativeHost.reactInstanceManager)
  }

  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    Log.d(TAG, "MainActivity onNewIntent - 从 LoadingActivity 返回")

    // 从 LoadingActivity 返回时，显示启动屏
    SplashScreen.show(this)
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

  /**
   * 窗口焦点变化时强制隐藏状态栏
   */
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // 每次获得焦点时强制隐藏状态栏（force = true）
      appInitializer.screenControlManager?.enableFullscreen(force = true)
      Log.d(TAG, "窗口获得焦点，强制隐藏状态栏")
    }
  }

  /**
   * 拦截按键事件
   */
  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    // 先尝试屏幕控制拦截
    if (appInitializer.screenControlManager?.onKeyDown(keyCode, event) == true) {
      return true
    }
    // 如果没有拦截，交给父类处理
    return super.onKeyDown(keyCode, event)
  }

  /**
   * 获取MultiDisplayManager实例（供TurboModule调用）
   */
  fun getMultiDisplayManager(): MultiDisplayManager? {
    return appInitializer.multiDisplayManager
  }

  /**
   * 获取ScreenControlManager实例（供TurboModule调用）
   */
  fun getScreenControlManager(): ScreenControlManager? {
    return appInitializer.screenControlManager
  }

  /**
   * 获取ReactInstanceManager实例（供AppRestartManager调用）
   */
  fun provideReactInstanceManager(): ReactInstanceManager {
    return reactNativeHost.reactInstanceManager
  }

  /**
   * 重新加载React应用（通过中间页避免退回桌面）
   * 用于重启功能，避免应用退回桌面
   */
  fun reloadReactApplication() {
    appRestartManager.reloadReactApplication()
  }
}
