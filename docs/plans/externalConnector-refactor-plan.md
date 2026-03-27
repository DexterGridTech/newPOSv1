# ExternalConnector 重构计划

## 目标

1. **缺口一**：删除 `KeyboardPassiveChannel`，HID 扫码枪改为通过 `externalConnector` 的 `subscribe()` 接入，走标准 stream 通道
2. **缺口二**：扩展 `IntentChannel` 支持 `startActivityForResult`，摄像头扫码通过 `INTENT` channel 实现，无需新增原生类

---

## 改动文件清单

### Kotlin 原生侧

| 文件 | 改动类型 | 说明 |
|------|------|------|
| `channels/KeyboardPassiveChannel.kt` | **删除** | 逻辑迁移到 HidStreamChannel |
| `channels/StreamChannels.kt` | **新增** `HidStreamChannel` | 封装 HID 键盘输入拼接逻辑，实现 StreamChannel 接口 |
| `channels/RequestResponseChannels.kt` | **修改** `IntentChannel` | 支持 `waitResult=true` 的 `startActivityForResult` 模式 |
| `ChannelRegistry.kt` | **修改** | `openStreamChannel` 新增 `HID` 分支；`getRequestResponseChannel` 无需改动 |
| `ConnectorTurboModule.kt` | **修改** | 删除 `keyboardChannel` 字段和 `init` 中的硬编码启动；`dispatchKeyEvent` 路由改为通过 registry |
| `MainActivity.kt` | **修改** | `dispatchKeyEvent` 改为通过 `ConnectorTurboModule` 的统一路由方法转发 |

### TS 侧

| 文件 | 改动类型 | 说明 |
|------|------|------|
| `dev/testTask/readBarCodeFromScanner.ts` | **修改** | 改为 `externalSubscribe` + `HID` channel |
| `dev/testTask/readBarCodeFromCamera.ts` | **修改** | 改为 `externalCall` + `INTENT` channel，`params.waitResult=true` |

---

## 详细设计

### Step 1：新增 HidStreamChannel（StreamChannels.kt）

HID 扫码枪以 HID Keyboard 模式工作，输入通过 `Activity.dispatchKeyEvent` 拦截。
`HidStreamChannel` 实现 `StreamChannel` 接口，内部持有原 `KeyboardPassiveChannel` 的拼接逻辑。

```
channel: { type: 'HID', target: 'keyboard', mode: 'stream' }
```

- `open()`：注册自身到 `ConnectorTurboModule` 的 key 路由表，开始接收按键事件
- `close()`：从路由表注销，停止接收
- `onKeyEvent(event)`：原 `KeyboardPassiveChannel.onKeyEvent` 逻辑，拼接字符后推送 `ConnectorEvent`
  - `data = mapOf("text" to text)`
  - `raw = text`
  - `target = desc.target`（即 `"keyboard"`）

**关键设计**：`HidStreamChannel` 不直接持有 `Activity` 引用，而是通过 `ConnectorTurboModule` 暴露的 `dispatchKeyEvent(event)` 方法接收事件，解耦 Activity 生命周期。

---

### Step 2：修改 ConnectorTurboModule

**删除**：
```kotlin
val keyboardChannel = KeyboardPassiveChannel()
// init 中的：
keyboardChannel.start { event -> sendEvent(EVENT_PASSIVE, event.toWritableMap()) }
```

**新增**：
```kotlin
// 活跃的 HID stream 通道，供 dispatchKeyEvent 路由
// key = channelId，value = HidStreamChannel
private val activeHidChannels = ConcurrentHashMap<String, HidStreamChannel>()

// MainActivity 调用此方法转发按键事件
fun onKeyEvent(event: android.view.KeyEvent): Boolean {
    if (activeHidChannels.isEmpty()) return false
    var consumed = false
    activeHidChannels.values.forEach { ch ->
        if (ch.onKeyEvent(event)) consumed = true
    }
    return consumed
}
```

`subscribe()` 中新增 HID 分支：
```kotlin
ChannelType.HID -> {
    val channelId = UUID.randomUUID().toString()
    val ch = HidStreamChannel(desc) { event ->
        sendEvent(EVENT_STREAM, event.toWritableMap())
    }
    ch.open()
    activeHidChannels[channelId] = ch
    activeStreams[channelId] = ch   // 复用 closeStreamChannel 逻辑
    promise.resolve(channelId)
}
```

`unsubscribe()` / `closeAll()` 时同步清理 `activeHidChannels`。

---

### Step 3：修改 ChannelRegistry

`openStreamChannel` 新增 HID 分支，但 HID 的 key 路由需要 `ConnectorTurboModule` 参与，
所以 HID 分支直接在 `ConnectorTurboModule.subscribe()` 中处理，不走 `ChannelRegistry`。

`ChannelRegistry` 只需在 `else` 分支的错误信息中去掉 HID 的排除即可（HID 不走这里）。

---

### Step 4：修改 IntentChannel（RequestResponseChannels.kt）

新增 `waitResult` 模式：当 `params` 包含 `"waitResult": true` 时，
使用 `ActivityResultLauncher` 启动 Activity 并等待结果。

```kotlin
class IntentChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        val waitResult = params.optBoolean("waitResult", false)
        if (!waitResult) {
            // 原有逻辑：fire and forget
            ...
        } else {
            // 新增：startActivityForResult，通过 PendingResultReceiver 等待回调
            // 使用 CountDownLatch 阻塞后台线程等待结果，超时后 resolve error
            EXECUTOR.submit {
                val latch = CountDownLatch(1)
                var result: WritableMap = errorMap(5001, "Intent result timeout")

                // 注册一次性 BroadcastReceiver 接收结果回调
                // Activity 完成后通过 LocalBroadcast 回传结果
                val resultAction = "com.impos2.connector.INTENT_RESULT_${System.currentTimeMillis()}"
                val receiver = object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context, intent: Intent) {
                        context.unregisterReceiver(this)
                        val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
                        val data = intent.getStringExtra("data")
                        result = if (resultCode == Activity.RESULT_OK && data != null)
                            successMap(jsonToWritableMap(JSONObject(data)), "OK")
                        else
                            errorMap(4001, "Activity result canceled or no data")
                        latch.countDown()
                    }
                }
                // 注册 receiver
                ...
                // 启动 Activity，携带 resultAction 让目标 Activity 知道回传地址
                val intent = Intent(action).apply {
                    params.keys().forEach { k ->
                        if (k != "waitResult") putExtra(k, params.optString(k))
                    }
                    putExtra("resultBroadcastAction", resultAction)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                latch.await(timeout, TimeUnit.MILLISECONDS)
                promise.resolve(result)
            }
        }
    }
}
```

**注意**：摄像头扫码的目标 Activity 需要在扫码完成后发送 `resultBroadcastAction` 广播。
对于系统摄像头（`MediaStore.ACTION_IMAGE_CAPTURE`）或第三方扫码库（ZXing），
它们不会主动发广播，需要一个中间 `TransparentResultActivity` 来桥接 `startActivityForResult` → 广播。

**因此 IntentChannel waitResult 的完整方案**：
1. `IntentChannel` 启动一个内部透明 `ResultBridgeActivity`（在 turbomodule-lib 的 AndroidManifest 中声明）
2. `ResultBridgeActivity` 用 `startActivityForResult` 启动真正的目标 Activity
3. `onActivityResult` 中把结果通过 LocalBroadcast 回传给 `IntentChannel` 的 receiver

---

### Step 5：修改 MainActivity

```kotlin
override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val module = reactInstanceManager?.currentReactContext
        ?.getNativeModule(ConnectorTurboModule::class.java)
    if (module?.onKeyEvent(event) == true) return true
    return super.dispatchKeyEvent(event)
}
```

`keyboardChannel` → `onKeyEvent`，接口不变，但内部路由到所有活跃的 `HidStreamChannel`。

---

### Step 6：更新 TS 侧 TaskDefinition

**readBarCodeFromScanner.ts**：
```
type: 'externalSubscribe'
channel: { type: 'HID', target: 'keyboard', mode: 'stream' }
```
每次收到 stream 事件，`data.text` 即为扫码内容。

**readBarCodeFromCamera.ts**：
```
type: 'externalCall'
channel: { type: 'INTENT', target: 'com.google.zxing.client.android.SCAN', mode: 'request-response' }
action: 'com.google.zxing.client.android.SCAN'
params: { waitResult: true, SCAN_MODE: 'QR_CODE_MODE' }
```
或使用系统摄像头：
```
action: 'android.media.action.IMAGE_CAPTURE'
params: { waitResult: true }
```

---

## 执行顺序

1. `StreamChannels.kt` — 新增 `HidStreamChannel`
2. `RequestResponseChannels.kt` — 修改 `IntentChannel` + 新增 `ResultBridgeActivity`
3. `ConnectorTurboModule.kt` — 删除 `keyboardChannel`，新增 `onKeyEvent` 路由，`subscribe` 支持 HID
4. `ChannelRegistry.kt` — 微调错误信息
5. `MainActivity.kt` — `dispatchKeyEvent` 改为调用 `module.onKeyEvent`
6. `KeyboardPassiveChannel.kt` — 删除文件
7. `readBarCodeFromScanner.ts` — 改为 `externalSubscribe` + HID
8. `readBarCodeFromCamera.ts` — 改为 `externalCall` + INTENT + waitResult
