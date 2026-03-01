package com.impos2.posadapterrn84.turbomodules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.impos2.posadapterrn84.NativeLoggerTurboModuleSpec

class PosAdapterTurboPackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            DeviceTurboModule.NAME -> DeviceTurboModule(reactContext)
            NativeLoggerTurboModuleSpec.NAME -> LoggerTurboModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            DeviceTurboModule.NAME to ReactModuleInfo(
                DeviceTurboModule.NAME,
                DeviceTurboModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true   // isTurboModule
            ),
            NativeLoggerTurboModuleSpec.NAME to ReactModuleInfo(
                NativeLoggerTurboModuleSpec.NAME,
                LoggerTurboModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true   // isTurboModule
            )
        )
    }
}
