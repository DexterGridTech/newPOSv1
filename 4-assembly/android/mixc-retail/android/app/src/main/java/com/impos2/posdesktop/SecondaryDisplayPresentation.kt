package com.impos2.posdesktop

import android.app.Activity
import android.app.Presentation
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import com.impos2.posadapter.turbomodules.device.DeviceManager
import android.view.ViewGroup
import android.view.WindowManager
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactRootView
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler

class SecondaryDisplayPresentation(
    private val activity: Activity,
    display: Display,
    private val reactInstanceManager: ReactInstanceManager,
    private val displayCount: Int
) : Presentation(activity, display), DefaultHardwareBackBtnHandler {

    private var reactRootView: ReactRootView? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var dismissed = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window?.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)

        val rootView = ReactRootView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        reactRootView = rootView
        setContentView(rootView)

        val deviceId = DeviceManager.getInstance(activity.applicationContext).getOrGenerateDeviceId()
        val launchOptions = Bundle().apply {
            putString("deviceId", deviceId)
            putString("screenMode", "desktop")
            putInt("displayCount", displayCount)
            putInt("displayIndex", 1)
        }

        reactInstanceManager.addReactInstanceEventListener(object : ReactInstanceEventListener {
            override fun onReactContextInitialized(context: ReactContext) {
                reactInstanceManager.removeReactInstanceEventListener(this)
                var attempts = 0
                val runnable = object : Runnable {
                    override fun run() {
                        if (dismissed) return
                        window?.decorView?.let {
                            it.requestLayout()
                            it.postInvalidate()
                        }
                        if (++attempts < 10) mainHandler.postDelayed(this, 100)
                    }
                }
                mainHandler.post(runnable)
            }
        })

        rootView.startReactApplication(reactInstanceManager, "PosDesktop", launchOptions)
    }

    override fun dismiss() {
        dismissed = true
        super.dismiss()
    }

    override fun onStop() {
        super.onStop()
        reactRootView?.unmountReactApplication()
    }

    override fun invokeDefaultOnBackPressed() {}
}
