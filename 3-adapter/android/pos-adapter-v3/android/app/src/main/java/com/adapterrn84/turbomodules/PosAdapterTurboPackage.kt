package com.adapterrn84.turbomodules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.adapterrn84.NativeLoggerTurboModuleSpec
import com.adapterrn84.NativeDeviceTurboModuleSpec
import com.adapterrn84.NativeScriptsTurboModuleSpec

class PosAdapterTurboPackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            NativeLoggerTurboModuleSpec.NAME -> LoggerTurboModule(reactContext)
            NativeDeviceTurboModuleSpec.NAME  -> DeviceTurboModule(reactContext)
            NativeScriptsTurboModuleSpec.NAME -> ScriptsTurboModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            NativeLoggerTurboModuleSpec.NAME to ReactModuleInfo(
                NativeLoggerTurboModuleSpec.NAME,
                LoggerTurboModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true   // isTurboModule
            ),
            NativeDeviceTurboModuleSpec.NAME to ReactModuleInfo(
                NativeDeviceTurboModuleSpec.NAME,
                DeviceTurboModule::class.java.name,
                false, false, false, true
            ),
            NativeScriptsTurboModuleSpec.NAME to ReactModuleInfo(
                NativeScriptsTurboModuleSpec.NAME,
                ScriptsTurboModule::class.java.name,
                false, false, false, true
            )
        )
    }
}
