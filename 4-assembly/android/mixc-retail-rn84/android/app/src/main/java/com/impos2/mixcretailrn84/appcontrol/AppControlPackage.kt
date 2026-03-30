package com.impos2.mixcretailrn84.appcontrol

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AppControlPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            AppControlModule.NAME -> AppControlModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            AppControlModule.NAME to ReactModuleInfo(
                AppControlModule.NAME,
                AppControlModule::class.java.name,
                false, false, false, true
            )
        )
    }
}
