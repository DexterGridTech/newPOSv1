package com.impos2.posdesktop

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.posadapter.turbomodules.device.DeviceManager
import com.impos2.posdesktop.screen.ScreenControlManager
import java.util.concurrent.atomic.AtomicBoolean
import org.devio.rn.splashscreen.SplashScreen

class MainActivity : ReactActivity() {

    lateinit var multiDisplayManager: MultiDisplayManager
    lateinit var screenControlManager: ScreenControlManager
    private lateinit var appRestartManager: AppRestartManager
    private val loadCompleted = AtomicBoolean(false)

    override fun getMainComponentName(): String = "PosDesktop"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            override fun getLaunchOptions(): Bundle = Bundle().apply {
                putString("deviceId", DeviceManager.getInstance(applicationContext).getOrGenerateDeviceId())
                putString("screenMode", "desktop")
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                putInt("displayCount", dm.displays.size)
                putInt("displayIndex", 0)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        SplashScreen.show(this, R.style.SplashScreenTheme, true)
        applySplashScreenFullscreen()
        super.onCreate(savedInstanceState)
        initManagers()
    }

    private fun applySplashScreenFullscreen() {
        // 先对 Activity window 设置全屏
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN)
        }
        // SplashScreen.show() 内部用 runOnUiThread 异步创建 Dialog
        // 需要 postDelayed 等 Dialog 创建完成后再反射设置全屏
        window.decorView.postDelayed({
            try {
                val field = org.devio.rn.splashscreen.SplashScreen::class.java.getDeclaredField("mSplashDialog")
                field.isAccessible = true
                val dialog = field.get(null) as? android.app.Dialog ?: return@postDelayed
                val win = dialog.window ?: return@postDelayed
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    win.setDecorFitsSystemWindows(false)
                    win.insetsController?.let {
                        it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                        it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    }
                } else {
                    @Suppress("DEPRECATION")
                    win.decorView.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    )
                }
            } catch (_: Exception) {}
        }, 50L)
    }

    private fun initManagers() {
        screenControlManager = ScreenControlManager(this)
        screenControlManager.initialize()
        multiDisplayManager = MultiDisplayManager(this, provideReactInstanceManager())
        appRestartManager = AppRestartManager(this)
    }

    override fun onResume() {
        super.onResume()
        if (::screenControlManager.isInitialized) screenControlManager.enableFullscreen()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && ::screenControlManager.isInitialized) screenControlManager.enableFullscreen()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // TODO: keyboardChannel 已移除，需要重新实现键盘事件处理
        // val module = reactInstanceManager
        //     .currentReactContext
        //     ?.getNativeModule(com.impos2.posadapter.turbomodules.connector.ConnectorTurboModule::class.java)
        // if (module?.keyboardChannel?.onKeyEvent(event) == true) return true
        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (::screenControlManager.isInitialized && screenControlManager.onKeyDown(keyCode)) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::screenControlManager.isInitialized) screenControlManager.destroy()
        if (::multiDisplayManager.isInitialized) multiDisplayManager.destroy()
    }

    /** JS 层加载完成后调用，只处理第一次（主屏），副屏的调用忽略 */
    fun onAppLoadComplete() {
        if (!loadCompleted.compareAndSet(false, true)) return
        SplashScreen.hide(this)
        multiDisplayManager.startSecondaryIfAvailable()
    }

    fun restartApp() {
        loadCompleted.set(false)
        appRestartManager.restart()
    }

    fun provideReactInstanceManager(): ReactInstanceManager =
        reactNativeHost.reactInstanceManager

    val isSecondaryDisplayActive: Boolean
        get() = if (::multiDisplayManager.isInitialized) multiDisplayManager.isSecondaryActive else false
}
