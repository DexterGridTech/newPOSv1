package com.impos2.posadapter.turbomodules

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * PosAdapter TurboModule 注册包
 * 在此处注册所有 TurboModule
 */
class PosAdapterTurboPackage : TurboReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            // 在此处注册 TurboModule，例如：
            // SomeTurboModule.NAME -> SomeTurboModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider { emptyMap() }
    }
}
