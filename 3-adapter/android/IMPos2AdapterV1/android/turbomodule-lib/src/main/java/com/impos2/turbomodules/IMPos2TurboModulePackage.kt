package com.impos2.turbomodules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class IMPos2TurboModulePackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            DeviceInfoTurboModule.NAME -> DeviceInfoTurboModule(reactContext)
            ExternalCallTurboModule.NAME -> ExternalCallTurboModule(reactContext)
            LoggerTurboModule.NAME -> LoggerTurboModule(reactContext)
            SystemStatusTurboModule.NAME -> SystemStatusTurboModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                DeviceInfoTurboModule.NAME to ReactModuleInfo(
                    DeviceInfoTurboModule.NAME,
                    DeviceInfoTurboModule::class.java.name,
                    false, // canOverrideExistingModule
                    false, // needsEagerInit
                    false, // isCxxModule
                    true   // isTurboModule
                ),
                ExternalCallTurboModule.NAME to ReactModuleInfo(
                    ExternalCallTurboModule.NAME,
                    ExternalCallTurboModule::class.java.name,
                    false, // canOverrideExistingModule
                    false, // needsEagerInit
                    false, // isCxxModule
                    true   // isTurboModule
                ),
                LoggerTurboModule.NAME to ReactModuleInfo(
                    LoggerTurboModule.NAME,
                    LoggerTurboModule::class.java.name,
                    false, // canOverrideExistingModule
                    false, // needsEagerInit
                    false, // isCxxModule
                    true   // isTurboModule
                ),
                SystemStatusTurboModule.NAME to ReactModuleInfo(
                    SystemStatusTurboModule.NAME,
                    SystemStatusTurboModule::class.java.name,
                    false, // canOverrideExistingModule
                    false, // needsEagerInit
                    false, // isCxxModule
                    true   // isTurboModule
                )
            )
        }
    }
}
