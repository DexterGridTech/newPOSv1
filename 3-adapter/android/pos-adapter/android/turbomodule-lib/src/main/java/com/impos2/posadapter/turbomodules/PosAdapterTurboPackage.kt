package com.impos2.posadapter.turbomodules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class PosAdapterTurboPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            LoggerTurboModule.NAME -> LoggerTurboModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            LoggerTurboModule.NAME to ReactModuleInfo(
                LoggerTurboModule.NAME,
                LoggerTurboModule::class.java.name,
                false, false, false, true
            )
        )
    }
}
