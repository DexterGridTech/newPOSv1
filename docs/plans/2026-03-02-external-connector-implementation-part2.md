# ExternalConnector 实现计划（续）

> 本文档是 `2026-03-02-external-connector-implementation.md` 的续篇
> 包含 Task 6 及之后的所有实现细节

## 当前进度

✅ **已完成（Task 1-5）：**
- ConnectorModels.kt, ChannelInterfaces.kt, ConnectorErrorCode.kt
- PermissionCoordinator.kt
- EventDispatcher.kt
- ChannelRegistry.kt
- PassiveChannelManager.kt

---

## 阶段三：核心管理层

### Task 6: ConnectorManager 和 ChannelFactory

**文件:**
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ConnectorManager.kt`
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ChannelFactory.kt`

**Step 1: 创建 ChannelFactory.kt**

```kotlin
package com.adapterrn84.turbomodules.connector

import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope

class ChannelFactory(
    private val context: ReactApplicationContext,
    private val scope: CoroutineScope,
    private val eventDispatcher: EventDispatcher
) {
    fun createRequestResponseChannel(descriptor: ChannelDescriptor): RequestResponseChannel {
        return when (descriptor.type) {
            ChannelType.INTENT -> IntentChannel(context, descriptor, eventDispatcher)
            ChannelType.NETWORK -> NetworkChannel(descriptor)
            ChannelType.SDK -> SdkChannel(descriptor)
            ChannelType.USB -> UsbChannel(context, descriptor)
            ChannelType.SERIAL -> SerialChannel(descriptor)
            ChannelType.BLUETOOTH -> BluetoothChannel(context, descriptor)
            ChannelType.AIDL -> AidlChannel(context, descriptor)
            ChannelType.HID -> throw IllegalArgumentException("HID only supports STREAM mode")
        }
    }

    fun createStreamChannel(descriptor: ChannelDescriptor): StreamChannel {
        return when (descriptor.type) {
            ChannelType.USB -> UsbStreamChannel(context, descriptor, scope)
            ChannelType.SERIAL -> SerialStreamChannel(descriptor, scope)
            ChannelType.BLUETOOTH -> BluetoothStreamChannel(context, descriptor, scope)
            ChannelType.HID -> HidStreamChannel(context, descriptor, scope, eventDispatcher)
            else -> throw IllegalArgumentException("${descriptor.type} does not support STREAM mode")
        }
    }
}
```

**Step 2: 创建 ConnectorManager.kt**

```kotlin
package com.adapterrn84.turbomodules.connector

import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

class ConnectorManager(private val context: ReactApplicationContext) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val eventDispatcher = EventDispatcher(context, scope)
    private val permissionCoordinator = PermissionCoordinator(context)
    private val channelFactory = ChannelFactory(context, scope, eventDispatcher)
    private val channelRegistry = ChannelRegistry(scope, eventDispatcher)
    private val passiveChannelManager = PassiveChannelManager(context, scope, eventDispatcher)

    suspend fun call(
        descriptor: ChannelDescriptor,
        action: String,
        params: Map<String, String>,
        timeout: Long
    ): ConnectorResult<String> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()

        try {
            // 检查并请求权限
            permissionCoordinator.ensurePermissions(descriptor.type)

            val permissionElapsed = System.currentTimeMillis() - startTime
            val remainingTimeout = (timeout - permissionElapsed).coerceAtLeast(1000)

            // 创建通道并执行
            val channel = channelFactory.createRequestResponseChannel(descriptor)

            withTimeout(remainingTimeout) {
                channel.execute(action, params, remainingTimeout)
            }
        } catch (e: TimeoutCancellationException) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.TIMEOUT,
                "Operation timeout after ${duration}ms",
                e,
                duration
            )
        } catch (e: SecurityException) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.PERMISSION_DENIED,
                e.message ?: "Permission denied",
                e,
                duration
            )
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "Unknown error",
                e,
                duration
            )
        }
    }

    suspend fun subscribe(descriptor: ChannelDescriptor): String {
        permissionCoordinator.ensurePermissions(descriptor.type)
        val channel = channelFactory.createStreamChannel(descriptor)
        return channelRegistry.register(channel)
    }

    suspend fun unsubscribe(channelId: String) {
        channelRegistry.unregister(channelId)
    }

    suspend fun isAvailable(descriptor: ChannelDescriptor): Boolean {
        return try {
            permissionCoordinator.ensurePermissions(descriptor.type)
            // TODO: 实现具体的可用性检查
            true
        } catch (e: Exception) {
            false
        }
    }

    fun getAvailableTargets(type: ChannelType): List<String> {
        // TODO: 实现具体的设备枚举
        return emptyList()
    }

    fun getEventDispatcher(): EventDispatcher = eventDispatcher

    fun getPermissionCoordinator(): PermissionCoordinator = permissionCoordinator

    fun cleanup() {
        channelRegistry.closeAll()
        passiveChannelManager.cleanup()
        eventDispatcher.cleanup()
        scope.cancel()
    }
}
```

**Step 3: 提交**

```bash
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ConnectorManager.kt
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ChannelFactory.kt
git commit -m "feat(connector): add connector manager and channel factory

- Add ConnectorManager as unified entry point
- Add ChannelFactory for creating channel instances
- Implement call/subscribe/unsubscribe methods
- Handle permissions and timeouts properly
- Integrate all management components

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 阶段四：TurboModule 层

### Task 7: ConnectorTurboModule

**文件:**
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/ConnectorTurboModule.kt`

**Step 1: 创建 ConnectorTurboModule.kt**

```kotlin
package com.adapterrn84.turbomodules

import com.adapterrn84.NativeConnectorTurboModuleSpec
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ConnectorTurboModule(reactContext: ReactApplicationContext) :
    NativeConnectorTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "ConnectorTurboModule"
    }

    private val connectorManager = ConnectorManager(reactApplicationContext)
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun getName(): String = NAME

    override fun call(
        channelJson: String,
        action: String,
        paramsJson: String,
        timeout: Double,
        promise: Promise
    ) {
        moduleScope.launch {
            try {
                val descriptor = ChannelDescriptor.fromJson(channelJson)
                val params = parseParams(paramsJson)
                val result = connectorManager.call(
                    descriptor,
                    action,
                    params,
                    timeout.toLong()
                )
                promise.resolve(result.toJson())
            } catch (e: Exception) {
                promise.reject("CALL_ERROR", e.message, e)
            }
        }
    }

    override fun subscribe(channelJson: String, promise: Promise) {
        moduleScope.launch {
            try {
                val descriptor = ChannelDescriptor.fromJson(channelJson)
                val channelId = connectorManager.subscribe(descriptor)
                promise.resolve(channelId)
            } catch (e: Exception) {
                promise.reject("SUBSCRIBE_ERROR", e.message, e)
            }
        }
    }

    override fun unsubscribe(channelId: String, promise: Promise) {
        moduleScope.launch {
            try {
                connectorManager.unsubscribe(channelId)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("UNSUBSCRIBE_ERROR", e.message, e)
            }
        }
    }

    override fun isAvailable(channelJson: String, promise: Promise) {
        moduleScope.launch {
            try {
                val descriptor = ChannelDescriptor.fromJson(channelJson)
                val available = connectorManager.isAvailable(descriptor)
                promise.resolve(available)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    override fun getAvailableTargets(type: String, promise: Promise) {
        moduleScope.launch {
            try {
                val channelType = ChannelType.fromString(type)
                val targets = connectorManager.getAvailableTargets(channelType)
                promise.resolve(targets.toTypedArray())
            } catch (e: Exception) {
                promise.resolve(emptyArray<String>())
            }
        }
    }

    override fun addListener(eventName: String?) {
        // Required by NativeEventEmitter, no-op
    }

    override fun removeListeners(count: Double) {
        // Required by NativeEventEmitter, no-op
    }

    override fun invalidate() {
        connectorManager.cleanup()
        super.invalidate()
    }

    private fun parseParams(json: String): Map<String, String> {
        val result = mutableMapOf<String, String>()
        try {
            val obj = org.json.JSONObject(json)
            obj.keys().forEach { key ->
                result[key] = obj.getString(key)
            }
        } catch (_: Exception) {
            // 返回空 map
        }
        return result
    }
}
```

**Step 2: 提交**

```bash
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/ConnectorTurboModule.kt
git commit -m "feat(connector): add connector turbo module

- Implement NativeConnectorTurboModuleSpec
- Bridge all methods to ConnectorManager
- Use coroutines for async operations
- Handle errors properly with Promise reject
- Implement cleanup on invalidate

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 阶段五：通道实现

由于通道实现代码量巨大（每个通道 100-300 行），建议分批实现。

### Task 8-15: 实现所有通道类型

创建目录结构：
```bash
mkdir -p 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/channels
```

每个通道实现为独立文件，详细代码见迁移指南第七章。

**通道列表：**
1. IntentChannel.kt + ResultBridgeActivity.kt
2. NetworkChannel.kt
3. SdkChannel.kt
4. UsbChannel.kt + UsbStreamChannel.kt
5. SerialChannel.kt + SerialStreamChannel.kt
6. BluetoothChannel.kt + BluetoothStreamChannel.kt
7. AidlChannel.kt
8. HidStreamChannel.kt

**辅助工具：**
- HexUtils.kt

---

## 下一步

由于通道实现和辅助组件代码量巨大，建议：
1. 先完成核心框架（Task 1-7）
2. 通道实现分批进行
3. 每个通道实现后独立测试

完整的通道实现代码请参考迁移指南文档。
