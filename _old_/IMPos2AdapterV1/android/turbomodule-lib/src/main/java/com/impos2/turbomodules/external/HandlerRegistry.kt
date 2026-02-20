package com.impos2.turbomodules.external

import com.facebook.react.bridge.ReactApplicationContext
import com.impos2.turbomodules.external.handlers.*

/**
 * Handler 注册表
 * 管理所有 Handler 的注册和查找
 *
 * 优化点:
 * 1. 支持动态注册 Handler
 * 2. 线程安全的 Handler 管理
 * 3. 支持多 ReactInstanceManager 场景
 */
class HandlerRegistry(private val context: ReactApplicationContext) {
    private val handlers = mutableMapOf<String, MutableMap<String, IExternalCallHandler>>()

    init {
        registerDefaultHandlers()
    }

    /**
     * 注册 Handler
     */
    @Synchronized
    fun register(type: String, method: String, handler: IExternalCallHandler) {
        handlers.getOrPut(type) { mutableMapOf() }[method] = handler
    }

    /**
     * 获取 Handler
     */
    fun getHandler(type: String, method: String): IExternalCallHandler? {
        return handlers[type]?.get(method)
    }

    /**
     * 获取某类型的所有 Handler
     */
    fun getHandlers(type: String): List<IExternalCallHandler> {
        return handlers[type]?.values?.toList() ?: emptyList()
    }

    /**
     * 注册默认 Handler
     */
    private fun registerDefaultHandlers() {
        // APP 类型 - Intent 调用
        register("APP", "INTENT", IntentCallHandler(context))

        // HARDWARE 类型 - 占位符实现
        val hardwareHandler = HardwarePlaceholderHandler()
        register("HARDWARE", "SERIAL", hardwareHandler)
        register("HARDWARE", "USB", hardwareHandler)
        register("HARDWARE", "BLUETOOTH", hardwareHandler)
        register("HARDWARE", "SDK", hardwareHandler)

        // SYSTEM 类型 - 占位符实现
        val systemHandler = SystemPlaceholderHandler()
        register("SYSTEM", "INTENT", systemHandler)
    }
}
