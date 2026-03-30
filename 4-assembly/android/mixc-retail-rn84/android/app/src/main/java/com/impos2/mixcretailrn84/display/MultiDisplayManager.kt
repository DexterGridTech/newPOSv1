package com.impos2.mixcretailrn84.display

import android.app.Activity
import android.app.Presentation
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import android.view.ViewGroup
import android.view.WindowManager
import com.facebook.react.ReactHost
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.adapterrn84.turbomodules.device.DeviceManager

class SecondaryDisplayPresentation(
    private val activity: Activity,
    display: Display,
    private val reactHost: ReactHost,
    private val displayCount: Int
) : Presentation(activity, display), DefaultHardwareBackBtnHandler {

    private var surface: com.facebook.react.interfaces.fabric.ReactSurface? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("THREAD_CHECK", "SecondaryDisplay onCreate thread = ${Thread.currentThread().name}")
        window?.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)

        val deviceId = DeviceManager.getInstance(activity.applicationContext).getOrGenerateDeviceId()
        val launchOptions = Bundle().apply {
            putString("deviceId", deviceId)
            putString("screenMode", "desktop")
            putInt("displayCount", displayCount)
            putInt("displayIndex", 1)
        }

        val s = reactHost.createSurface(context, "MixcRetailRN84", launchOptions)
        surface = s
        s.start()

        val view = s.view
        if (view != null) {
            view.layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setContentView(view)
        }
    }

    override fun dismiss() {
        surface?.stop()
        surface = null
        super.dismiss()
    }

    override fun invokeDefaultOnBackPressed() {}
}

class MultiDisplayManager(
    private val activity: Activity,
    private val reactHost: ReactHost
) {
    private var presentation: SecondaryDisplayPresentation? = null
    val isSecondaryActive: Boolean get() = presentation?.isShowing == true

    fun startSecondaryIfAvailable() {
        val dm = activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val displays = dm.displays
        if (displays.size < 2) return
        val secondary = displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY } ?: return
        if (presentation?.isShowing == true) return

        // 确保在 main 线程创建和显示 Presentation
        Handler(Looper.getMainLooper()).post {
            presentation = SecondaryDisplayPresentation(activity, secondary, reactHost, displays.size)
            presentation?.show()
        }
    }

    fun destroy() {
        presentation?.dismiss()
        presentation = null
    }
}
