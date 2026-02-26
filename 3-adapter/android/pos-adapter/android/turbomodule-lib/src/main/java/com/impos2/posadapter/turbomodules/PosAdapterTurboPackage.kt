package com.impos2.posadapter.turbomodules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

import com.impos2.posadapter.turbomodules.connector.ConnectorTurboModule

class PosAdapterTurboPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            LoggerTurboModule.NAME       -> LoggerTurboModule(reactContext)
            DeviceTurboModule.NAME       -> DeviceTurboModule(reactContext)
            ExternalCallTurboModule.NAME -> ExternalCallTurboModule(reactContext)
            ScriptsTurboModule.NAME      -> ScriptsTurboModule(reactContext)
            LocalWebServerTurboModule.NAME -> LocalWebServerTurboModule(reactContext)
            ConnectorTurboModule.NAME    -> ConnectorTurboModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            LoggerTurboModule.NAME to ReactModuleInfo(
                LoggerTurboModule.NAME, LoggerTurboModule::class.java.name,
                false, false, false, true
            ),
            DeviceTurboModule.NAME to ReactModuleInfo(
                DeviceTurboModule.NAME, DeviceTurboModule::class.java.name,
                false, false, false, true
            ),
            ExternalCallTurboModule.NAME to ReactModuleInfo(
                ExternalCallTurboModule.NAME, ExternalCallTurboModule::class.java.name,
                false, false, false, true
            ),
            ScriptsTurboModule.NAME to ReactModuleInfo(
                ScriptsTurboModule.NAME, ScriptsTurboModule::class.java.name,
                false, false, false, true
            ),
            LocalWebServerTurboModule.NAME to ReactModuleInfo(
                LocalWebServerTurboModule.NAME, LocalWebServerTurboModule::class.java.name,
                false, false, false, true
            ),
            ConnectorTurboModule.NAME to ReactModuleInfo(
                ConnectorTurboModule.NAME, ConnectorTurboModule::class.java.name,
                false, false, false, true
            )
        )
    }
}
