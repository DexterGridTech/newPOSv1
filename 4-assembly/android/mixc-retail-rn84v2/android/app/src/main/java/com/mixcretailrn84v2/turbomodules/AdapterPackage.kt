package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AdapterPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      DeviceTurboModule.NAME -> DeviceTurboModule(reactContext)
      LoggerTurboModule.NAME -> LoggerTurboModule(reactContext)
      ScriptsTurboModule.NAME -> ScriptsTurboModule(reactContext)
      ConnectorTurboModule.NAME -> ConnectorTurboModule(reactContext)
      LocalWebServerTurboModule.NAME -> LocalWebServerTurboModule(reactContext)
      AppControlTurboModule.NAME -> AppControlTurboModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      DeviceTurboModule.NAME to ReactModuleInfo(
        DeviceTurboModule.NAME,
        DeviceTurboModule::class.java.name,
        false,
        false,
        false,
        true
      ),
      LoggerTurboModule.NAME to ReactModuleInfo(
        LoggerTurboModule.NAME,
        LoggerTurboModule::class.java.name,
        false,
        false,
        false,
        true
      ),
      ScriptsTurboModule.NAME to ReactModuleInfo(
        ScriptsTurboModule.NAME,
        ScriptsTurboModule::class.java.name,
        false,
        false,
        false,
        true
      ),
      ConnectorTurboModule.NAME to ReactModuleInfo(
        ConnectorTurboModule.NAME,
        ConnectorTurboModule::class.java.name,
        false,
        false,
        false,
        true
      ),
      LocalWebServerTurboModule.NAME to ReactModuleInfo(
        LocalWebServerTurboModule.NAME,
        LocalWebServerTurboModule::class.java.name,
        false,
        false,
        false,
        true
      ),
      AppControlTurboModule.NAME to ReactModuleInfo(
        AppControlTurboModule.NAME,
        AppControlTurboModule::class.java.name,
        false,
        false,
        false,
        true
      )
    )
  }
}
