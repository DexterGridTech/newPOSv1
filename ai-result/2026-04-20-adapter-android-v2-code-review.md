# 3-adapter/android/adapter-android-v2 代码审查报告

**日期**：2026-04-20  
**审查范围**：`adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/`  
**文件列表**：ScriptEngineManager.kt、ConnectorManager.kt、LogManager.kt、DeviceManager.kt、CameraScannerManager.kt、AppControlManager.kt

---

## 一、总体评价

整体并发设计较为谨慎，使用了 `ConcurrentHashMap`、`AtomicBoolean/Long/Integer`、`CopyOnWriteArraySet` 等线程安全结构。但存在若干严重的安全漏洞（JSON 注入）、资源泄漏、以及 Android 生命周期管理问题。

---

## 二、问题清单

### [CRITICAL] C1 — escapeJson() 未处理控制字符，存在 JSON 注入风险

**位置**：`scripts/ScriptEngineManager.kt`

```kotlin
private fun String.escapeJson(): String {
    val sb = StringBuilder()
    for (ch in this) {
        when (ch) {
            '"'  -> sb.append("\\\"")
            '\\' -> sb.append("\\\\")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            else -> sb.append(ch)  // ← U+0000–U+001F 未转义
        }
    }
    return sb.toString()
}
```

**问题**：JSON 规范（RFC 8259）要求 U+0000–U+001F 的控制字符必须转义。当前实现直接输出这些字符，会产生非法 JSON，部分解析器会静默截断或产生歧义，可被用于注入攻击（如 `\u0000` 截断字符串边界）。

**建议**：在 `else` 分支前添加：
```kotlin
in '\u0000'..'\u001F' -> sb.append("\\u%04x".format(ch.code))
```

---

### [CRITICAL] C2 — parseJsonLiteral() 不反转义字符串，返回原始转义内容

**位置**：`scripts/ScriptEngineManager.kt`

```kotlin
'"' -> value.substring(1, value.length - 1)  // 直接截取，未反转义
```

**问题**：对于包含 `\"`, `\\`, `\n` 等转义序列的 JSON 字符串，该函数直接返回原始内容（含反斜杠），而非实际字符串值。调用方拿到的是 `hello\\nworld` 而非 `hello\nworld`，导致数据静默损坏。这是一个功能性 bug，影响所有从 QuickJS 返回的字符串结果。

**建议**：实现完整的 JSON 字符串反转义，或使用 `org.json.JSONObject` / `kotlinx.serialization` 解析返回值，不要手写 JSON 解析器。

---

### [HIGH] H1 — activeExecution 单字段无法支持并发执行，存在竞态条件

**位置**：`scripts/ScriptEngineManager.kt`

```kotlin
@Volatile private var activeExecution: ScriptExecutionContext? = null

fun execute(...) {
    val ctx = ScriptExecutionContext(...)
    activeExecution = ctx          // ← 覆盖上一个执行
    // ...
    activeExecution = null
}
```

**问题**：`activeExecution` 只能持有一个执行上下文。若两个协程并发调用 `execute()`，第二个会覆盖第一个的引用，导致第一个执行的 timeout/poison 机制失效——超时后无法正确中断第一个执行。`@Volatile` 只保证可见性，不保证原子性。

**建议**：使用 `AtomicReference<ScriptExecutionContext?>` 或将并发执行序列化（单线程调度器 + 队列）。

---

### [HIGH] H2 — startSystemFilePicker 的 cancelAction 未调用 finishTask，任务永久泄漏

**位置**：`connector/ConnectorManager.kt`

```kotlin
task.cancelAction = {
    canceledTaskCount.incrementAndGet()
    // ← 缺少 finishTask(task, canceledResponse, callback)
}
```

**问题**：当文件选择器任务被取消时，`cancelAction` 只递增计数器，但没有从 `tasks` Map 中移除该任务，也没有回调通知调用方。该任务会永久留在 `tasks` 中，造成内存泄漏，且后续无法再为同一 `taskId` 创建新任务。

**建议**：在 `cancelAction` 中调用 `finishTask(task, canceledResponse, callback)`，与其他 connector 的取消逻辑保持一致。

---

### [HIGH] H3 — HID connector 只向第一个订阅者分发事件

**位置**：`connector/ConnectorManager.kt`

```kotlin
val subscription = subscriptions.values.firstOrNull() ?: return false
subscription.callback(hidData)
```

**问题**：HID 输入事件只分发给 `subscriptions` 中的第一个订阅者，其余订阅者永远收不到事件。这与 camera/passive connector 的广播模式不一致，且在多个组件同时订阅 HID 时会产生不可预期的行为（哪个组件收到事件取决于 Map 的迭代顺序）。

**建议**：遍历所有订阅者：`subscriptions.values.forEach { it.callback(hidData) }`。

---

### [HIGH] H4 — LogManager 中 SimpleDateFormat 非线程安全，多协程并发写日志会崩溃

**位置**：`logger/LogManager.kt`

```kotlin
private val dateFormat = SimpleDateFormat(DATE_FORMAT, Locale.getDefault())
private val timestampFormat = SimpleDateFormat(TIMESTAMP_FORMAT, Locale.getDefault())
```

**问题**：`SimpleDateFormat` 不是线程安全的。`LogManager` 使用协程并发写日志，多个协程同时调用 `dateFormat.format()` 会导致 `ArrayIndexOutOfBoundsException` 或返回错误的日期字符串。这是一个已知的 Java 并发陷阱。

**建议**：改用 `java.time.format.DateTimeFormatter`（线程安全），或将格式化操作限制在单一协程/线程中执行。

---

### [HIGH] H5 — getCpuUsage() 对 lastCpuStat 的读-改-写非原子，存在竞态

**位置**：`device/DeviceManager.kt`

```kotlin
val prev = lastCpuStat      // 读
val curr = readProcStat()
lastCpuStat = curr          // 写（非原子）
```

**问题**：`lastCpuStat` 是普通字段（即使加 `@Volatile` 也不够），两次并发调用 `getCpuUsage()` 时，两者都读到相同的 `prev`，然后都写入各自的 `curr`，导致 CPU 使用率计算错误（两次计算使用相同的基准值）。

**建议**：使用 `AtomicReference<CpuStat>` 配合 `compareAndSet` 实现原子更新，或用 `Mutex` 序列化访问。

---

### [MEDIUM] M1 — scheduleRestore 捕获 Activity 引用，存在内存泄漏

**位置**：`appcontrol/AppControlManager.kt`

```kotlin
restoreRunnable = Runnable {
    if (fullscreenEnabled) { hideSystemBars(activity) }  // activity 可能已销毁
}.also { mainHandler.postDelayed(it, 500L) }
```

**问题**：`Runnable` 通过闭包持有 `activity` 强引用，`mainHandler.postDelayed` 延迟 500ms 执行。若 Activity 在这 500ms 内被销毁（旋转屏幕、返回键等），Runnable 仍持有其引用，导致内存泄漏，且调用已销毁 Activity 的方法可能崩溃。

**建议**：改用 `WeakReference<Activity>`，执行前检查引用是否仍有效。

---

### [MEDIUM] M2 — enableFullscreen 在 onCreated/onStarted/onResumed 三处重复调用

**位置**：`appcontrol/AppControlManager.kt`

```kotlin
override fun onActivityCreated(...) { enableFullscreen(activity) }
override fun onActivityStarted(...) { enableFullscreen(activity) }
override fun onActivityResumed(...) { enableFullscreen(activity) }
```

**问题**：同一个 Activity 生命周期内，`enableFullscreen` 会被连续调用三次。虽然结果幂等，但造成不必要的系统调用开销，且掩盖了真正需要处理的时机（通常只需在 `onWindowFocusChanged` 或 `onResume` 中处理一次）。

**建议**：仅保留 `onActivityResumed` 中的调用，或改用 `WindowInsetsController` 的持久化设置。

---

### [MEDIUM] M3 — exit(0) 强制终止进程，不允许资源清理

**位置**：`appcontrol/AppControlManager.kt`

```kotlin
Runtime.getRuntime().exit(0)
```

**问题**：`Runtime.exit(0)` 立即终止 JVM 进程，不会触发 `onDestroy`、`onStop` 等生命周期回调，也不会执行 `finally` 块或 `Closeable.close()`。这会导致：未刷新的日志丢失、数据库事务未提交、文件句柄未关闭。

**建议**：改用 `finishAffinity()` + `System.exit(0)` 组合，或通过广播通知所有组件先完成清理再退出。

---

### [MEDIUM] M4 — sha256() 每次调用都创建新的 MessageDigest 实例，性能浪费

**位置**：`scripts/ScriptEngineManager.kt`

```kotlin
private fun sha256(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
    // ...
}
```

**问题**：`MessageDigest.getInstance("SHA-256")` 每次都通过 JCA Provider 查找并实例化，在脚本缓存场景下（每次加载脚本都调用一次）会产生不必要的对象分配和查找开销。

**建议**：将 `MessageDigest` 实例缓存为字段（注意 `MessageDigest` 非线程安全，需用 `ThreadLocal` 或每次 `clone()`），或使用 `Guava` 的 `Hashing.sha256()`。

---

### [MEDIUM] M5 — CameraScannerManager 超时后无法真正取消扫描 Activity

**位置**：`camera/CameraScannerManager.kt` + `connector/ConnectorManager.kt`

**问题**：ConnectorManager 的 camera 任务超时后调用 `task.cancelAction`，该 action 只递增计数器，但 `CameraScanActivity` 仍在前台运行，用户仍可完成扫描并触发回调。超时后的扫描结果会被送达一个已经"取消"的任务，产生状态不一致。

**建议**：`cancelAction` 中应通过 `ResultReceiver` 或广播通知 `CameraScanActivity` 关闭自身（`finish()`）。

---

### [MEDIUM] M6 — LogManager 的 CoroutineScope 缺少 SupervisorJob，单次失败会取消整个 scope

**位置**：`logger/LogManager.kt`

```kotlin
private val scope = CoroutineScope(Dispatchers.IO)
```

**问题**：没有 `SupervisorJob`，任何一个日志写入协程抛出未捕获异常，都会取消整个 `scope`，导致后续所有日志写入静默失败。

**建议**：改为 `CoroutineScope(SupervisorJob() + Dispatchers.IO)`。

---

### [LOW] L1 — DeviceManager.getNetworkInfo() 使用已废弃 API，Android 10+ 行为不确定

**位置**：`device/DeviceManager.kt`

```kotlin
@Suppress("DEPRECATION")
val info = cm.activeNetworkInfo
```

**问题**：`ConnectivityManager.activeNetworkInfo` 在 API 29 (Android 10) 中已废弃，在 API 33+ 中可能返回 `null`。当前代码用 `@Suppress` 压制警告但没有提供 fallback，在新版 Android 上网络状态检测会静默失效。

**建议**：使用 `cm.getNetworkCapabilities(cm.activeNetwork)` 替代，并保留旧 API 作为低版本 fallback。

---

### [LOW] L2 — touchSupport 硬编码为 true，不反映实际设备能力

**位置**：`device/DeviceManager.kt`

```kotlin
touchSupport = true
```

**问题**：部分 POS 机型没有触摸屏（纯按键操作），硬编码 `true` 会导致上层逻辑误判设备能力，可能显示不必要的触摸引导 UI 或启用触摸相关功能。

**建议**：通过 `packageManager.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN)` 动态检测。

---

## 三、设计层面问题

### D1 — 所有 Manager 使用相同的双重检查锁单例模式，但实现细节不一致

`ScriptEngineManager`、`ConnectorManager`、`LogManager`、`DeviceManager`、`AppControlManager` 均使用：

```kotlin
companion object {
    @Volatile private var instance: XxxManager? = null
    fun getInstance(...): XxxManager {
        return instance ?: synchronized(this) {
            instance ?: XxxManager(...).also { instance = it }
        }
    }
}
```

但各 Manager 的初始化参数不同（有的需要 `Context`，有的不需要），部分 Manager 在 `getInstance` 中接受 `Context` 但不检查是否传入了 `applicationContext`，可能持有 Activity Context 导致泄漏。

**建议**：统一使用 `applicationContext`，或改用依赖注入框架（Hilt/Koin）管理生命周期。

---

### D2 — ConnectorManager 四种 connector 的任务生命周期管理逻辑分散，缺乏统一抽象

camera、HID、intent、passive 四种 connector 各自实现任务创建/完成/取消逻辑，代码重复且行为不一致（如 H2、H3 所示）。

**建议**：提取 `ConnectorTask` 抽象，统一 `start/finish/cancel` 生命周期，各 connector 只实现具体的 IO 逻辑。

---

## 四、缺失测试覆盖

| 文件 | 缺失测试的关键逻辑 |
|---|---|
| `ScriptEngineManager` | `escapeJson`、`parseJsonLiteral`、并发执行、超时中断 |
| `ConnectorManager` | 任务取消流程、HID 多订阅者分发 |
| `LogManager` | 并发写入、日志轮转 |
| `DeviceManager` | `getCpuUsage` 并发安全性 |

---

## 五、优先级汇总

| 级别 | 编号 | 问题 |
|------|------|------|
| CRITICAL | C1 | `escapeJson()` 未处理控制字符，JSON 注入风险 |
| CRITICAL | C2 | `parseJsonLiteral()` 不反转义，数据静默损坏 |
| HIGH | H1 | `activeExecution` 单字段，并发执行竞态 |
| HIGH | H2 | `startSystemFilePicker` cancelAction 未调用 finishTask，任务泄漏 |
| HIGH | H3 | HID 只向第一个订阅者分发事件 |
| HIGH | H4 | `SimpleDateFormat` 非线程安全，并发日志写入崩溃 |
| HIGH | H5 | `getCpuUsage()` read-modify-write 非原子 |
| MEDIUM | M1 | `scheduleRestore` 捕获 Activity 强引用，内存泄漏 |
| MEDIUM | M2 | `enableFullscreen` 三处重复调用 |
| MEDIUM | M3 | `exit(0)` 不允许资源清理 |
| MEDIUM | M4 | `sha256()` 每次创建新 MessageDigest 实例 |
| MEDIUM | M5 | 超时后无法真正取消 CameraScanActivity |
| MEDIUM | M6 | CoroutineScope 缺少 SupervisorJob |
| LOW | L1 | `getNetworkInfo()` 使用废弃 API，Android 10+ 失效 |
| LOW | L2 | `touchSupport` 硬编码为 true |
