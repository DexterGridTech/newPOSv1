package com.mixcretail.turbomodules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.turbomodule.core.interfaces.TurboModule

class AdapterPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            DeviceTurboModule.NAME -> DeviceTurboModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            DeviceTurboModule.NAME to ReactModuleInfo(
                DeviceTurboModule.NAME,
                DeviceTurboModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                true,  // isCxxModule
                true   // isTurboModule
            )
        )
    }
}
