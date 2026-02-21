package com.impos2.posdesktop

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
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
                putString("deviceId", android.provider.Settings.Secure.getString(
                    contentResolver, android.provider.Settings.Secure.ANDROID_ID) ?: "")
                putString("screenMode", "desktop")
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                putInt("displayCount", dm.displays.size)
                putInt("displayIndex", 0)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        SplashScreen.show(this, R.style.SplashScreenTheme, true)
        // 在 super.onCreate 前提前设置全屏 flag，避免 SplashScreen 闪烁
        @Suppress("DEPRECATION")
        window.setFlags(
            android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN,
            android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        }
        super.onCreate(savedInstanceState)
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
}
