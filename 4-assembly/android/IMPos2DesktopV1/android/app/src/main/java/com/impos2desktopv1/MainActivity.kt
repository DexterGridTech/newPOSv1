package com.impos2desktopv1

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2desktopv1.multidisplay.MultiDisplayManager

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
  }

  private var multiDisplayManager: MultiDisplayManager? = null
  private val mainHandler = Handler(Looper.getMainLooper())

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
    try {
      super.onCreate(savedInstanceState)
      Log.d(TAG, "MainActivity onCreate")
    } catch (e: Exception) {
      Log.e(TAG, "主屏初始化失败", e)
    }
  }

  override fun onResume() {
    super.onResume()
    Log.d(TAG, "MainActivity onResume")

    // 只在首次启动时初始化多屏显示
    if (multiDisplayManager == null) {
      mainHandler.postDelayed({
        initializeMultiDisplay()
      }, 3000)
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    try {
      multiDisplayManager?.destroy()
      multiDisplayManager = null
      Log.d(TAG, "多屏资源已释放")
    } catch (e: Exception) {
      Log.e(TAG, "销毁多屏资源失败", e)
    }
  }

  /**
   * 初始化多屏显示
   */
  private fun initializeMultiDisplay() {
    try {
      if (multiDisplayManager == null) {
        val reactInstanceManager = reactNativeHost.reactInstanceManager
        multiDisplayManager = MultiDisplayManager(this, reactInstanceManager)
        multiDisplayManager?.initialize()
        Log.d(TAG, "多屏显示管理器已初始化")
      }
    } catch (e: Exception) {
      Log.e(TAG, "初始化多屏显示失败", e)
    }
  }

  /**
   * 获取MultiDisplayManager实例（供TurboModule调用）
   */
  fun getMultiDisplayManager(): MultiDisplayManager? {
    return multiDisplayManager
  }

  /**
   * 重新加载React应用（通过中间页避免退回桌面）
   * 用于重启功能，避免应用退回桌面
   */
  fun reloadReactApplication() {
    try {
      Log.d(TAG, "开始重新加载React应用（通过中间页）")

      // 跳转到 LoadingActivity
      val intent = Intent(this, LoadingActivity::class.java).apply {
        putExtra(LoadingActivity.EXTRA_MESSAGE, "正在重启应用...")
        putExtra(LoadingActivity.EXTRA_AUTO_RETURN, true)
        putExtra(LoadingActivity.EXTRA_DELAY_MS, 2500L) // 2.5秒后返回
      }
      startActivity(intent)

      // 延迟1秒后开始重新创建 ReactContext
      // 确保 LoadingActivity 已经完全显示
      mainHandler.postDelayed({
        try {
          Log.d(TAG, "开始重新创建ReactContext")
          val reactInstanceManager = reactNativeHost.reactInstanceManager

          // 使用 recreateReactContextInBackground 重新加载
          reactInstanceManager.recreateReactContextInBackground()

          Log.d(TAG, "ReactContext重新创建已触发")
        } catch (e: Exception) {
          Log.e(TAG, "重新创建ReactContext失败", e)
        }
      }, 1000)

    } catch (e: Exception) {
      Log.e(TAG, "reloadReactApplication失败", e)
    }
  }
}
