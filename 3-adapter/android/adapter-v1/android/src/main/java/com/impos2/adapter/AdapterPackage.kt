package com.impos2.adapter

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AdapterPackage : TurboReactPackage() {

    override fun getModule(
        name: String,
        reactContext: ReactApplicationContext
    ): NativeModule? {
        return when (name) {
            ScriptsTurboModule.NAME -> ScriptsTurboModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            ScriptsTurboModule.NAME to ReactModuleInfo(
                ScriptsTurboModule.NAME,
                ScriptsTurboModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                true,  // isCxxModule
                true   // isTurboModule
            )
        )
    }
}
