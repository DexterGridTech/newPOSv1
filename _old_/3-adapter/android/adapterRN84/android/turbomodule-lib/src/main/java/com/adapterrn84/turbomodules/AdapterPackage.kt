package com.adapterrn84.turbomodules

import android.util.Log
import com.adapterrn84.turbomodules.appcontrol.AppControlModule
import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AdapterPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        Log.d("AdapterPackage", "getModule called: $name")
        return when (name) {
            AppControlModule.NAME -> AppControlModule(reactContext)
            DeviceTurboModule.NAME -> DeviceTurboModule(reactContext)
            LoggerTurboModule.NAME -> LoggerTurboModule(reactContext)
            ScriptsTurboModule.NAME -> ScriptsTurboModule(reactContext)
            ConnectorTurboModule.NAME -> ConnectorTurboModule(reactContext)
            LocalWebServerTurboModule.NAME -> LocalWebServerTurboModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        Log.d("AdapterPackage", "getReactModuleInfoProvider called")
        mapOf(
            AppControlModule.NAME to ReactModuleInfo(
                AppControlModule.NAME,
                AppControlModule::class.java.name,
                false, false, false, true
            ),
            DeviceTurboModule.NAME to ReactModuleInfo(
                DeviceTurboModule.NAME,
                DeviceTurboModule::class.java.name,
                false, false, false, true
            ),
            LoggerTurboModule.NAME to ReactModuleInfo(
                LoggerTurboModule.NAME,
                LoggerTurboModule::class.java.name,
                false, false, false, true
            ),
            ScriptsTurboModule.NAME to ReactModuleInfo(
                ScriptsTurboModule.NAME,
                ScriptsTurboModule::class.java.name,
                false, false, false, true
            ),
            ConnectorTurboModule.NAME to ReactModuleInfo(
                ConnectorTurboModule.NAME,
                ConnectorTurboModule::class.java.name,
                false, false, false, true
            ),
            LocalWebServerTurboModule.NAME to ReactModuleInfo(
                LocalWebServerTurboModule.NAME,
                LocalWebServerTurboModule::class.java.name,
                false, false, false, true
            )
        )
    }
}
