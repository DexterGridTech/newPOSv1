package com.impos2.mixcretailrn84

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.mixcretailrn84.display.MultiDisplayManager
import com.impos2.mixcretailrn84.loading.LoadingManager
import com.impos2.mixcretailrn84.restart.AppRestartManager
import com.impos2.mixcretailrn84.screen.ScreenControlManager
import com.impos2.adapter.device.DeviceManager
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : ReactActivity() {

    lateinit var screenControlManager: ScreenControlManager
    lateinit var multiDisplayManager: MultiDisplayManager
    lateinit var appRestartManager: AppRestartManager
    private val loadCompleted = AtomicBoolean(false)

    companion object {
        @Volatile
        var instance: MainActivity? = null
            private set
    }

    override fun getMainComponentName(): String = "MixcRetailRN84"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            override fun getLaunchOptions(): Bundle {
                val deviceInfo = DeviceManager.getInstance(applicationContext).getDeviceInfo()
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                return Bundle().apply {
                    putString("deviceId", deviceInfo.id)
                    putString("screenMode", "desktop")
                    putInt("displayCount", dm.displays.size)
                    putInt("displayIndex", 0)
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d("THREAD_CHECK", "onCreate thread = ${Thread.currentThread().name}")
        instance = this
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !LoadingManager.isHideRequested() }
        super.onCreate(savedInstanceState)

        // 延迟初始化，避免与 SplashScreen attach 冲突
        Handler(Looper.getMainLooper()).post {
            Log.d("THREAD_CHECK", "initManagers thread = ${Thread.currentThread().name}")
            initManagers()
        }
    }

    private fun initManagers() {
        screenControlManager = ScreenControlManager(this).also { it.initialize() }
        multiDisplayManager = MultiDisplayManager(this)
        appRestartManager = AppRestartManager(this)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (::screenControlManager.isInitialized && screenControlManager.onKeyDown(keyCode)) return true
        return super.onKeyDown(keyCode, event)
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
        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::screenControlManager.isInitialized) screenControlManager.destroy()
        if (::multiDisplayManager.isInitialized) multiDisplayManager.destroy()
        instance = null
    }

    fun restartApp() {
        loadCompleted.set(false)
        appRestartManager.restart()
    }

    fun provideReactInstanceManager(): ReactInstanceManager =
        reactNativeHost.reactInstanceManager

    fun provideReactHost(): com.facebook.react.ReactHost = reactHost

    val isSecondaryDisplayActive: Boolean
        get() = if (::multiDisplayManager.isInitialized) multiDisplayManager.isSecondaryActive else false
}
