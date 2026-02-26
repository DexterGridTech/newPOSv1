# ExternalConnector 实现计划

## 策略说明

- 保留现有 `ExternalCall` 接口不动（向后兼容）
- 新增 `ExternalConnector` 接口到 `kernel-core-base`
- 新建 `ConnectorTurboModule`（Kotlin），不改动现有 `ExternalCallTurboModule`
- 适配层实现 `ExternalConnector` 并注册

---

## 步骤一：kernel-core-base — 新增 ExternalConnector 接口和类型

### 1.1 新增类型文件
`1-kernel/1.1-cores/base/src/types/foundations/externalConnector.ts`

```typescript
export type ChannelType = 'INTENT' | 'AIDL' | 'USB' | 'SERIAL' | 'BLUETOOTH' | 'NETWORK' | 'SDK'
export type InteractionMode = 'request-response' | 'stream' | 'passive'

export interface ChannelDescriptor {
  type: ChannelType
  target: string
  mode: InteractionMode
  options?: Record<string, any>
}

export interface ConnectorEvent<T = any> {
  channelId: string
  type: ChannelType
  target: string
  data: T
  timestamp: number
  raw?: string
}

export interface ConnectorResponse<T = any> {
  success: boolean
  code: number
  message: string
  data?: T
  duration: number
  timestamp: number
}
```

### 1.2 新增 Adapter 接口文件
`1-kernel/1.1-cores/base/src/foundations/adapters/externalConnector.ts`

```typescript
export interface ExternalConnector {
  call<T>(channel, action, params?, timeout?): Promise<ConnectorResponse<T>>
  subscribe(channel, onEvent, onError?): Promise<string>   // 返回 channelId
  unsubscribe(channelId: string): Promise<void>
  on(eventType: string, handler): () => void               // 返回 off 函数
  isAvailable(channel): Promise<boolean>
}

// 代理对象 + register 函数（与现有 externalCall.ts 模式一致）
export const externalConnector: ExternalConnector = { ... }
export const registerExternalConnector = (impl) => { ... }
```

### 1.3 更新 adapters/index.ts
新增 `export * from './externalConnector'`

### 1.4 更新 types/foundations/index.ts
新增 `export * from './externalConnector'`

---

## 步骤二：kernel-core-base — 新增 ExternalCallTaskAdapter（externalCall 类型）

`1-kernel/1.1-cores/task/src/foundations/taskAdapter/externalCallTaskAdapter.ts`

- 实现 `TaskAdapter`，type = `'externalCall'`
- `request-response` 模式：`connector.call()` → next + complete
- `stream` 模式：`connector.subscribe()` → 每次事件 next，cancel$ 触发时 unsubscribe + complete

在 `taskSystem.ts` 中注册此 adapter。

---

## 步骤三：适配层 Kotlin — 新建 ConnectorTurboModule

`3-adapter/android/pos-adapter/android/turbomodule-lib/.../ConnectorTurboModule.kt`

### 3.1 数据类
```kotlin
data class ChannelDescriptor(val type: ChannelType, val target: String,
                              val mode: InteractionMode, val options: JSONObject?)
data class ConnectorEvent(val channelId: String, val type: ChannelType,
                          val target: String, val data: Any,
                          val timestamp: Long, val raw: String? = null)
```

### 3.2 通道接口
```kotlin
interface RequestResponseChannel { fun call(action, params, timeout, promise) }
interface StreamChannel { fun open(); fun close() }
interface PassiveChannel { fun start(onEvent); fun stop() }
```

### 3.3 ChannelRegistry
- `getRequestResponseChannel(desc)` → 按 type 返回对应 Channel 实例
- `openStreamChannel(desc, onEvent)` → 生成 channelId，open，存入 activeStreams
- `closeStreamChannel(channelId)` → close + 从 map 移除

### 3.4 ConnectorTurboModule
- `call(channelJson, action, paramsJson, timeout, promise)` → RequestResponseChannel
- `subscribe(channelJson, promise)` → openStreamChannel，resolve channelId
- `unsubscribe(channelId, promise)` → closeStreamChannel
- 事件推送：`DeviceEventManager.emit("connector.stream", ...)`
- 被动接收：`DeviceEventManager.emit("connector.passive", ...)`

### 3.5 各通道实现（RequestResponse 模式）
- `IntentChannel`：startActivity
- `AidlChannel`：bindService + transact
- `UsbChannel`：bulkTransfer（一次性）
- `SerialChannel`：FileOutputStream/InputStream（一次性）
- `BluetoothChannel`：RfcommSocket（一次性）
- `NetworkChannel`：HttpURLConnection
- `SdkChannel`：反射调用

### 3.6 各通道实现（Stream 模式）
- `UsbStreamChannel`：独立线程 + bulkTransfer 轮询（100ms timeout）
- `SerialStreamChannel`：独立线程 + InputStream 轮询
- `BluetoothStreamChannel`：独立线程 + InputStream 读取
- `WebSocketChannel`：OkHttp WebSocket

### 3.7 被动接收（Passive 模式）
- `IntentPassiveChannel`：BroadcastReceiver，在 MainApplication 注册
- `LocalSocketPassiveChannel`：LocalServerSocket 监听（可选）

### 3.8 注册到 PosAdapterTurboPackage
在 `getModule` 和 `getReactModuleInfoProvider` 中添加 `ConnectorTurboModule`

---

## 步骤四：适配层 TS — 实现 ExternalConnector 接口

`3-adapter/android/pos-adapter/src/foundations/externalConnector.ts`

```typescript
import { NativeModules, NativeEventEmitter } from 'react-native'
import { ExternalConnector } from '@impos2/kernel-core-base'

const { ConnectorTurboModule } = NativeModules
const emitter = new NativeEventEmitter(ConnectorTurboModule)

export const externalConnectorAdapter: ExternalConnector = {
  call(channel, action, params, timeout) {
    return ConnectorTurboModule.call(JSON.stringify(channel), action,
      JSON.stringify(params ?? {}), timeout ?? 30000)
  },
  subscribe(channel, onEvent, onError) {
    const sub = emitter.addListener('connector.stream', (event) => {
      if (event.channelId === channelId) onEvent(event)
    })
    return ConnectorTurboModule.subscribe(JSON.stringify(channel))
      .then(id => { channelId = id; return id })
  },
  unsubscribe(channelId) {
    return ConnectorTurboModule.unsubscribe(channelId)
  },
  on(eventType, handler) {
    const sub = emitter.addListener(eventType, handler)
    return () => sub.remove()
  },
  isAvailable(channel) {
    return ConnectorTurboModule.isAvailable(JSON.stringify(channel))
  }
}
```

### 4.1 更新 foundations/index.ts
新增 `export * from './externalConnector'`

### 4.2 更新 modulePreSetup.ts
在初始化时调用 `registerExternalConnector(externalConnectorAdapter)`

---

## 步骤五：验证

`3-adapter/android/pos-adapter/dev/` 中添加测试代码：
- 测试 USB stream 订阅（模拟扫码枪）
- 测试 Passive 接收（模拟外部 Intent）
- 测试 request-response call（现有功能回归）

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `kernel-core-base/src/types/foundations/externalConnector.ts` | 新建 |
| `kernel-core-base/src/foundations/adapters/externalConnector.ts` | 新建 |
| `kernel-core-base/src/foundations/adapters/index.ts` | 修改（新增导出） |
| `kernel-core-base/src/types/foundations/index.ts` | 修改（新增导出） |
| `kernel-core-task/src/foundations/taskAdapter/externalCallTaskAdapter.ts` | 新建 |
| `kernel-core-task/src/foundations/taskSystem.ts` | 修改（注册 adapter） |
| `pos-adapter/android/.../ConnectorTurboModule.kt` | 新建 |
| `pos-adapter/android/.../channels/` | 新建（各通道实现） |
| `pos-adapter/android/.../PosAdapterTurboPackage.kt` | 修改（注册模块） |
| `pos-adapter/src/foundations/externalConnector.ts` | 新建 |
| `pos-adapter/src/foundations/index.ts` | 修改（新增导出） |
| `pos-adapter/src/application/modulePreSetup.ts` | 修改（注册 adapter） |
