package com.impos2.posdesktop

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.impos2.posdesktop.screen.ScreenControlTurboModule

class AppTurboPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            AppTurboModule.NAME -> AppTurboModule(reactContext)
            ScreenControlTurboModule.NAME -> ScreenControlTurboModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            AppTurboModule.NAME to ReactModuleInfo(
                AppTurboModule.NAME, AppTurboModule::class.java.name,
                false, false, false, true
            ),
            ScreenControlTurboModule.NAME to ReactModuleInfo(
                ScreenControlTurboModule.NAME, ScreenControlTurboModule::class.java.name,
                false, false, false, true
            )
        )
    }
}
