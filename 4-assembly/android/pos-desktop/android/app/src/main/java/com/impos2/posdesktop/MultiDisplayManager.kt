package com.impos2.posdesktop

import android.app.Activity
import android.content.Context
import android.hardware.display.DisplayManager
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactPackage
import com.facebook.react.common.LifecycleState
import com.facebook.react.shell.MainReactPackage
import com.impos2.posadapter.turbomodules.PosAdapterTurboPackage
import com.reactnativemmkv.MmkvPackage

class MultiDisplayManager(
    private val activity: Activity,
    private val mainReactInstanceManager: ReactInstanceManager
) {
    private val displayManager = activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    private var secondaryPresentation: SecondaryDisplayPresentation? = null
    private var secondaryReactInstanceManager: ReactInstanceManager? = null

    fun startSecondaryIfAvailable() {
        if (secondaryPresentation != null) return
        val secondary = displayManager.displays.firstOrNull { it.displayId != 0 } ?: return
        val rim = createSecondaryReactInstanceManager()
        secondaryReactInstanceManager = rim
        secondaryPresentation = SecondaryDisplayPresentation(activity, secondary, rim, displayManager.displays.size).also { it.show() }
    }

    fun destroy() {
        secondaryPresentation?.dismiss()
        secondaryPresentation = null
        secondaryReactInstanceManager?.destroy()
        secondaryReactInstanceManager = null
    }

    val isSecondaryActive get() = secondaryPresentation?.isShowing == true

    private val secondaryPackages: List<ReactPackage> = listOf(
        MainReactPackage(),
        PosAdapterTurboPackage(),
        MmkvPackage(),
        AppTurboPackage(),
    )

    private fun createSecondaryReactInstanceManager(): ReactInstanceManager {
        val builder = ReactInstanceManager.builder()
            .setApplication(activity.application)
            .setCurrentActivity(activity)
            .addPackages(secondaryPackages)
            .setUseDeveloperSupport(BuildConfig.DEBUG)
            .setInitialLifecycleState(LifecycleState.RESUMED)
        if (BuildConfig.DEBUG) builder.setJSMainModulePath("index")
        else builder.setBundleAssetName("index.android.bundle")
        return builder.build()
    }
}
