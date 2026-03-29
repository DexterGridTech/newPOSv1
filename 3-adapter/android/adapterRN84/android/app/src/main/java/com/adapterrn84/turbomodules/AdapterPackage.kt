package com.adapterrn84.turbomodules

import android.util.Log
import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AdapterPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        Log.d("AdapterPackage", "getModule called: $name")
        return when (name) {
            DeviceTurboModule.NAME -> DeviceTurboModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        Log.d("AdapterPackage", "getReactModuleInfoProvider called")
        mapOf(
            DeviceTurboModule.NAME to ReactModuleInfo(
                DeviceTurboModule.NAME,
                DeviceTurboModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule — Kotlin 模块，非 C++
                true   // isTurboModule
            )
        )
    }
}
