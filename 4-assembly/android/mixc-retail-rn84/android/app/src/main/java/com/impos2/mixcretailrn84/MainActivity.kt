package com.impos2.mixcretailrn84

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.animation.AnimationUtils
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.mixcretailrn84.display.MultiDisplayManager
import com.impos2.mixcretailrn84.loading.LoadingManager
import com.impos2.mixcretailrn84.restart.AppRestartManager
import com.impos2.mixcretailrn84.screen.ScreenControlManager
import com.adapterrn84.turbomodules.device.DeviceManager
import org.devio.rn.splashscreen.SplashScreen
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

        fun getInstance(): MainActivity? = instance
    }

    override fun getMainComponentName(): String = "MixcRetailRN84"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            override fun getLaunchOptions(): Bundle {
                val deviceId = DeviceManager.getInstance(applicationContext).getOrGenerateDeviceId()
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                return Bundle().apply {
                    putString("deviceId", deviceId)
                    putString("screenMode", "desktop")
                    putInt("displayCount", dm.displays.size)
                    putInt("displayIndex", 0)
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        instance = this
        SplashScreen.show(this, R.style.SplashScreenTheme, true)
        applySplashScreenFullscreen()
        super.onCreate(savedInstanceState)
        initManagers()
    }

    private fun initManagers() {
        screenControlManager = ScreenControlManager(this).also { it.initialize() }
        multiDisplayManager = MultiDisplayManager(this, reactHost)
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

    private fun applySplashScreenFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN)
        }
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
                startSplashAnimations(dialog)
            } catch (_: Exception) {}
        }, 50L)
    }

    private fun startSplashAnimations(dialog: android.app.Dialog) {
        val root = dialog.findViewById<View>(android.R.id.content) ?: return
        root.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        val allAnimations = listOf(
            R.id.splash_bg_breathe to R.anim.splash_breathe,
            R.id.splash_arc_back_view to R.anim.splash_float_slow,
            R.id.splash_arc_front_view to R.anim.splash_float_reverse,
            R.id.splash_orbit_ring_view to R.anim.splash_rotate_orbit,
            R.id.splash_sweep_glow_view to R.anim.splash_sweep,
            R.id.splash_sphere_primary_view to R.anim.splash_float_slow,
            R.id.splash_sphere_secondary_view to R.anim.splash_float_reverse,
            R.id.splash_brand_text to R.anim.splash_text_top_in,
            R.id.splash_system_text to R.anim.splash_text_middle_in,
            R.id.splash_loading_text to R.anim.splash_text_bottom_in,
        )
        allAnimations.forEach { (viewId, animId) ->
            root.findViewById<View>(viewId)?.let { view ->
                view.setLayerType(View.LAYER_TYPE_HARDWARE, null)
                view.startAnimation(AnimationUtils.loadAnimation(this, animId))
            }
        }
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

    fun getReactHost(): com.facebook.react.ReactHost = reactHost

    val isSecondaryDisplayActive: Boolean
        get() = if (::multiDisplayManager.isInitialized) multiDisplayManager.isSecondaryActive else false
}
