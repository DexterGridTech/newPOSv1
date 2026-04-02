package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * 整合层 BaseReactPackage。
 *
 * 这个包是 JS 与整合层原生能力建立连接的总入口。它把当前工程需要暴露给 JS 的 TurboModule
 * 集中注册到 RN 新架构宿主中。
 *
 * 这里不直接包含 adapterPure 的所有能力实现，而是只暴露“整合层真正需要提供给 JS 的桥接模块”：
 * - 设备信息
 * - 日志
 * - 脚本执行
 * - Connector
 * - LocalWebServer
 * - AppControl
 */
class AdapterPackage : BaseReactPackage() {

  /**
   * 按名称返回对应的 TurboModule 实例。
   *
   * 名称必须和 JS Spec 中 `TurboModuleRegistry.getEnforcing('...')` 使用的模块名完全一致，
   * 否则会触发 `could not be found` 类问题。
   */
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

  /**
   * 提供 RN 新架构所需的模块元信息。
   *
   * 这些元数据会影响模块的发现、懒加载与新架构注册过程，因此必须与实际导出的模块保持一致。
   */
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
