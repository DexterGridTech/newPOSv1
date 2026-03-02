# ExternalConnector 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 实现完整的 ExternalConnector 模块，支持 8 种通道类型（INTENT, AIDL, USB, SERIAL, BLUETOOTH, NETWORK, SDK, HID）× 3 种交互模式（REQUEST_RESPONSE, STREAM, PASSIVE），基于 Kotlin 协程优化架构，完全符合 RN 0.84.1 Codegen TurboModule 规范。

**架构:** 采用协程优化架构，使用 suspend 函数和 Flow 替代传统回调，通过 ConnectorManager 统一管理所有通道，ChannelFactory 负责创建通道实例，ChannelRegistry 管理流通道生命周期，PassiveChannelManager 处理被动事件，EventDispatcher 统一分发事件。

**技术栈:**
- Kotlin Coroutines (suspend, Flow, CoroutineScope)
- React Native 0.84.1 Codegen TurboModule
- CameraX + ML Kit (相机扫码)
- Android BroadcastReceiver, Service, Activity

---

## 阶段一：核心基础设施

### Task 1: Kotlin 核心数据类和接口

**文件:**
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ConnectorModels.kt`
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ChannelInterfaces.kt`
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ConnectorErrorCode.kt`

**Step 1: 创建 ConnectorModels.kt**

定义核心数据类：

```kotlin
package com.adapterrn84.turbomodules.connector

import org.json.JSONObject

enum class ChannelType {
    INTENT, AIDL, USB, SERIAL, BLUETOOTH, NETWORK, SDK, HID;

    companion object {
        fun fromString(value: String): ChannelType = valueOf(value.uppercase())
    }
}

enum class InteractionMode {
    REQUEST_RESPONSE, STREAM, PASSIVE;

    companion object {
        fun fromString(value: String): InteractionMode {
            return when (value.lowercase().replace("_", "-")) {
                "request-response" -> REQUEST_RESPONSE
                "stream" -> STREAM
                "passive" -> PASSIVE
                else -> valueOf(value.uppercase())
            }
        }
    }
}

data class ChannelDescriptor(
    val type: ChannelType,
    val target: String,
    val mode: InteractionMode,
    val options: Map<String, String> = emptyMap()
) {
    companion object {
        fun fromJson(json: String): ChannelDescriptor {
            val obj = JSONObject(json)
            val optionsObj = obj.optJSONObject("options")
            val options = mutableMapOf<String, String>()
            optionsObj?.keys()?.forEach { key ->
                options[key] = optionsObj.getString(key)
            }

            return ChannelDescriptor(
                type = ChannelType.fromString(obj.getString("type")),
                target = obj.getString("target"),
                mode = InteractionMode.fromString(obj.getString("mode")),
                options = options
            )
        }
    }
}

data class ConnectorEvent(
    val channelId: String,
    val type: String,
    val target: String,
    val data: String?,
    val timestamp: Long,
    val raw: String? = null
) {
    fun toJson(): String = JSONObject().apply {
        put("channelId", channelId)
        put("type", type)
        put("target", target)
        put("data", data)
        put("timestamp", timestamp)
        if (raw != null) put("raw", raw)
    }.toString()
}

sealed class ConnectorResult<out T> {
    data class Success<T>(
        val data: T,
        val duration: Long,
        val timestamp: Long = System.currentTimeMillis()
    ) : ConnectorResult<T>()

    data class Failure(
        val code: Int,
        val message: String,
        val cause: Throwable? = null,
        val duration: Long,
        val timestamp: Long = System.currentTimeMillis()
    ) : ConnectorResult<Nothing>()

    fun toJson(): String {
        return when (this) {
            is Success -> JSONObject().apply {
                put("success", true)
                put("code", 0)
                put("message", "OK")
                put("data", data)
                put("duration", duration)
                put("timestamp", timestamp)
            }.toString()
            is Failure -> JSONObject().apply {
                put("success", false)
                put("code", code)
                put("message", message)
                put("duration", duration)
                put("timestamp", timestamp)
            }.toString()
        }
    }
}
```

**Step 2: 创建 ChannelInterfaces.kt**

定义通道接口：

```kotlin
package com.adapterrn84.turbomodules.connector

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharedFlow

interface RequestResponseChannel {
    suspend fun execute(
        action: String,
        params: Map<String, String>,
        timeout: Long
    ): ConnectorResult<String>

    fun close()
}

interface StreamChannel {
    fun open(): Flow<ConnectorEvent>
    suspend fun close()
}

interface PassiveChannel {
    val events: SharedFlow<ConnectorEvent>
    suspend fun start()
    suspend fun stop()
}
```

**Step 3: 创建 ConnectorErrorCode.kt**

定义错误码：

```kotlin
package com.adapterrn84.turbomodules.connector

object ConnectorErrorCode {
    const val SUCCESS = 0
    const val TIMEOUT = 1001
    const val PERMISSION_DENIED = 1002
    const val DEVICE_NOT_FOUND = 1003
    const val CONNECTION_FAILED = 1004
    const val IO_ERROR = 1005
    const val INVALID_PARAMS = 1006
    const val CHANNEL_CLOSED = 1007
    const val USB_PERMISSION_DENIED = 1008
    const val UNKNOWN = 9999
}
```

**Step 4: 提交**

```bash
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/
git commit -m "feat(connector): add core data models and interfaces

- Add ChannelType, InteractionMode enums
- Add ChannelDescriptor, ConnectorEvent data classes
- Add ConnectorResult sealed class with Success/Failure
- Add RequestResponseChannel, StreamChannel, PassiveChannel interfaces
- Add ConnectorErrorCode constants

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 权限管理器

**文件:**
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/PermissionCoordinator.kt`

**Step 1: 创建 PermissionCoordinator.kt**

```kotlin
package com.adapterrn84.turbomodules.connector

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap

class PermissionCoordinator(private val context: ReactApplicationContext) {

    private val permissionRequests = ConcurrentHashMap<String, CompletableDeferred<Boolean>>()

    suspend fun ensurePermissions(channelType: ChannelType) {
        val permissions = getRequiredPermissions(channelType)
        if (permissions.isEmpty()) return

        permissions.forEach { permission ->
            if (!hasPermission(permission)) {
                requestPermission(permission)
            }
        }
    }

    private fun getRequiredPermissions(channelType: ChannelType): List<String> = when (channelType) {
        ChannelType.BLUETOOTH -> if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            listOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            )
        } else {
            listOf(Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN)
        }
        ChannelType.HID -> listOf(Manifest.permission.CAMERA)
        else -> emptyList()
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            context.currentActivity ?: context,
            permission
        ) == PackageManager.PERMISSION_GRANTED
    }

    private suspend fun requestPermission(permission: String) {
        val deferred = CompletableDeferred<Boolean>()
        val requestCode = permission.hashCode() and 0xFFFF

        permissionRequests[permission] = deferred

        withContext(Dispatchers.Main) {
            val activity = context.currentActivity
                ?: throw IllegalStateException("No activity available for permission request")

            ActivityCompat.requestPermissions(
                activity,
                arrayOf(permission),
                requestCode
            )
        }

        val granted = try {
            withTimeout(30000) { deferred.await() }
        } catch (e: Exception) {
            false
        }

        if (!granted) {
            throw SecurityException("Permission denied: $permission")
        }
    }

    fun onPermissionResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        permissions.forEachIndexed { index, permission ->
            permissionRequests.remove(permission)?.complete(
                grantResults.getOrNull(index) == PackageManager.PERMISSION_GRANTED
            )
        }
    }
}
```

**Step 2: 提交**

```bash
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/PermissionCoordinator.kt
git commit -m "feat(connector): add permission coordinator

- Add PermissionCoordinator for runtime permission management
- Support BLUETOOTH and CAMERA permissions
- Use coroutines for async permission requests
- Handle Android 12+ BLUETOOTH_CONNECT/SCAN permissions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: 事件分发器

**文件:**
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/EventDispatcher.kt`

**Step 1: 创建 EventDispatcher.kt**

```kotlin
package com.adapterrn84.turbomodules.connector

import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * 统一事件分发器
 * 替代多个全局单例，集中管理所有事件分发逻辑
 */
class EventDispatcher(
    private val context: ReactApplicationContext,
    private val scope: CoroutineScope
) {
    // HID 通道注册表
    private val hidChannels = ConcurrentHashMap<String, MutableList<HidEventHandler>>()

    // Activity Result 回调
    private val activityResultCallbacks = ConcurrentHashMap<Int, ActivityResultCallback>()

    interface HidEventHandler {
        suspend fun onKeyEvent(keyCode: Int, event: KeyEvent)
    }

    interface ActivityResultCallback {
        fun onResult(resultCode: Int, data: android.content.Intent?)
    }

    /**
     * 发送流事件到 TS 层
     */
    fun sendStreamEvent(event: ConnectorEvent) {
        try {
            val params = WritableNativeMap().apply {
                putString("channelId", event.channelId)
                putString("type", event.type)
                putString("target", event.target)
                if (event.data != null) {
                    putString("data", event.data)
                } else {
                    putNull("data")
                }
                putDouble("timestamp", event.timestamp.toDouble())
                if (event.raw != null) putString("raw", event.raw)
            }

            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("connector.stream", params)
        } catch (_: Exception) {
            // ReactContext may be invalidated
        }
    }

    /**
     * 发送被动事件到 TS 层
     */
    fun sendPassiveEvent(event: ConnectorEvent) {
        try {
            val params = WritableNativeMap().apply {
                putString("channelId", event.channelId)
                putString("type", event.type)
                putString("target", event.target)
                if (event.data != null) {
                    putString("data", event.data)
                } else {
                    putNull("data")
                }
                putDouble("timestamp", event.timestamp.toDouble())
                if (event.raw != null) putString("raw", event.raw)
            }

            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("connector.passive", params)
        } catch (_: Exception) {
            // ReactContext may be invalidated
        }
    }

    /**
     * 注册 HID 事件处理器
     */
    fun registerHidHandler(target: String, handler: HidEventHandler) {
        hidChannels.getOrPut(target) { mutableListOf() }.add(handler)
    }

    /**
     * 注销 HID 事件处理器
     */
    fun unregisterHidHandler(target: String, handler: HidEventHandler) {
        hidChannels[target]?.remove(handler)
        if (hidChannels[target]?.isEmpty() == true) {
            hidChannels.remove(target)
        }
    }

    /**
     * 分发按键事件到所有 HID 通道
     */
    fun dispatchKeyEvent(keyCode: Int, event: KeyEvent) {
        scope.launch(Dispatchers.IO) {
            hidChannels.values.flatten().forEach { handler ->
                try {
                    handler.onKeyEvent(keyCode, event)
                } catch (_: Exception) {
                    // Ignore errors in individual handlers
                }
            }
        }
    }

    /**
     * 注册 Activity Result 回调
     */
    fun registerActivityResultCallback(requestCode: Int, callback: ActivityResultCallback) {
        activityResultCallbacks[requestCode] = callback
    }

    /**
     * 注销 Activity Result 回调
     */
    fun unregisterActivityResultCallback(requestCode: Int) {
        activityResultCallbacks.remove(requestCode)
    }

    /**
     * 分发 Activity Result
     */
    fun dispatchActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        activityResultCallbacks.remove(requestCode)?.onResult(resultCode, data)
    }

    /**
     * 清理所有注册
     */
    fun cleanup() {
        hidChannels.clear()
        activityResultCallbacks.clear()
    }
}
```

**Step 2: 提交**

```bash
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/EventDispatcher.kt
git commit -m "feat(connector): add unified event dispatcher

- Replace multiple global singletons with EventDispatcher
- Handle stream/passive event emission to RN
- Manage HID key event distribution
- Manage Activity Result callbacks
- Centralize all event dispatching logic

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 阶段二：通道管理层

### Task 4: ChannelRegistry（流通道管理）

**文件:**
- Create: `3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ChannelRegistry.kt`

**Step 1: 创建 ChannelRegistry.kt**

```kotlin
package com.adapterrn84.turbomodules.connector

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class ChannelRegistry(
    private val scope: CoroutineScope,
    private val eventDispatcher: EventDispatcher
) {

    private data class ChannelEntry(
        val channel: StreamChannel,
        val job: Job
    )

    private val channels = ConcurrentHashMap<String, ChannelEntry>()

    suspend fun register(channel: StreamChannel): String {
        val channelId = UUID.randomUUID().toString()

        val job = scope.launch {
            channel.open()
                .catch { e ->
                    // 发送错误事件
                    val errorEvent = ConnectorEvent(
                        channelId = channelId,
                        type = "error",
                        target = "",
                        data = null,
                        timestamp = System.currentTimeMillis(),
                        raw = e.message
                    )
                    eventDispatcher.sendStreamEvent(errorEvent)
                }
                .collect { event ->
                    // 添加 channelId 并发送
                    val eventWithId = event.copy(channelId = channelId)
                    eventDispatcher.sendStreamEvent(eventWithId)
                }
        }

        channels[channelId] = ChannelEntry(channel, job)
        return channelId
    }

    suspend fun unregister(channelId: String) {
        channels.remove(channelId)?.let { entry ->
            entry.job.cancel()
            entry.channel.close()
        }
    }

    fun closeAll() {
        channels.values.forEach { entry ->
            entry.job.cancel()
            runBlocking { entry.channel.close() }
        }
        channels.clear()
    }
}
```

**Step 2: 提交**

```bash
git add 3-adapter/android/pos-adapter-v3/android/app/src/main/java/com/adapterrn84/turbomodules/connector/ChannelRegistry.kt
git commit -m "feat(connector): add channel registry for stream management

- Manage lifecycle of all stream channels
- Auto-emit events to RN via EventDispatcher
- Handle channel errors gracefully
- Support cleanup on unsubscribe

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

由于实现计划非常长（预计超过 3000 行），我将继续编写剩余部分...

