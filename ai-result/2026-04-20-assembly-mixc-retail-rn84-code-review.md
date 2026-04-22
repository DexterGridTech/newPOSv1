# 4-assembly/android/mixc-retail-assembly-rn84 代码审查报告

**日期**：2026-04-20  
**审查范围**：`mixc-retail-assembly-rn84` 整合层所有 Kotlin 源文件  
**文件列表**：MainApplication、MainActivity、SecondaryActivity、StartupCoordinator、SecondaryProcessController、StartupOverlayManager、AppRestartManager、ConnectorTurboModule、AppControlTurboModule、ScriptsTurboModule、HotUpdateTurboModule、HotUpdateBundleResolver、HotUpdateBootMarkerStore

---

## 一、总体评价

整合层整体设计清晰，职责分离较好，启动编排、进程间通信、热更新链路均有完整的审计日志和超时保护。但存在以下几类问题：安全性隐患（热更新下载无 HTTPS 强制）、并发状态管理缺陷、资源泄漏、以及部分设计不一致。

---

## 二、问题清单

### [CRITICAL] C1 — HotUpdateTurboModule 下载使用 java.net.URL，不强制 HTTPS，存在中间人攻击风险

**位置**：`turbomodules/HotUpdateTurboModule.kt:53`

```kotlin
URL(packageUrl).openStream().use { input ->
    archive.outputStream().use { output -> input.copyTo(output) }
}
```

**问题**：`java.net.URL.openStream()` 不验证证书，且 `packageUrlsJson` 来自 JS 层，若传入 `http://` URL，下载的 bundle 可被中间人替换为恶意代码。即使有 SHA-256 校验，攻击者只需同时替换 URL 响应和 SHA 值（若 SHA 也来自不可信来源）即可绕过。热更新 bundle 直接影响应用运行时，这是最高风险点。

**建议**：
1. 强制校验 URL scheme 必须为 `https`，拒绝 `http` URL；
2. 使用 `HttpsURLConnection` 并配置证书固定（Certificate Pinning）；
3. `packageSha256` 应来自可信的服务端签名，不应由 JS 层直接传入。

---

### [CRITICAL] C2 — HotUpdateBootMarkerStore 跨进程文件锁在 Android 上不可靠

**位置**：`HotUpdateBootMarkerStore.kt:26-33`

```kotlin
RandomAccessFile(lockFile, "rw").channel.use { channel ->
    channel.lock().use {
        return block()
    }
}
```

**问题**：`FileChannel.lock()` 在 Android（Linux）上是进程级锁，同一进程内多线程调用不互斥（`FileLock` 只阻止其他进程）。主进程和副进程（`:secondary`）都会调用 `HotUpdateBootMarkerStore`，两个进程的文件锁可以互斥，但同一进程内并发调用（如 `HotUpdateTurboModule` 在 JS 线程调用，`HotUpdateBundleResolver` 在主线程调用）不受保护，会产生竞态。

**建议**：在文件锁外层再加进程内 `synchronized` 或 `Mutex`，实现双重保护。

---

### [HIGH] H1 — MainActivity.instance 静态引用在 Activity 重建时存在短暂空窗期

**位置**：`MainActivity.kt:103` + `AppControlTurboModule.kt:56`

```kotlin
// MainActivity.onCreate
instance = this  // 在 super.onCreate() 之前设置

// AppControlTurboModule.hideLoading
val activity = MainActivity.instance ?: error("MainActivity not ready")
```

**问题**：重启流程中，旧 `MainActivity` 销毁时 `instance = null`，新 `MainActivity` 的 `onCreate` 尚未执行时，`instance` 为 `null`。若 JS 在这个窗口期调用 `hideLoading(displayIndex=0)`，会抛出 `error("MainActivity not ready")`，导致启动编排永远无法触发 `onAppLoadComplete`，应用卡死在启动遮罩状态。

**建议**：`hideLoading` 中对 `MainActivity.instance == null` 的情况应有重试机制或延迟队列，而不是直接抛错。

---

### [HIGH] H2 — StartupCoordinator 是非线程安全的 object，pendingOverlayHide/pendingSecondaryStart 无同步保护

**位置**：`startup/StartupCoordinator.kt:36-38`

```kotlin
private var pendingOverlayHide: Runnable? = null
private var pendingSecondaryStart: Runnable? = null
```

**问题**：`StartupCoordinator` 是 Kotlin `object`（单例），`pendingOverlayHide` 和 `pendingSecondaryStart` 是普通可变字段，没有 `@Volatile` 也没有同步块。虽然大多数调用都在主线程，但 `onAppLoadComplete` 可能从 JS 线程调用（通过 TurboModule），与主线程的 `cancelPendingActions` 并发执行时会产生竞态，导致旧 Runnable 未被正确取消。

**建议**：确保所有对 `pendingOverlayHide`/`pendingSecondaryStart` 的访问都通过 `mainHandler.post` 序列化，或加 `@Volatile`。

---

### [HIGH] H3 — ConnectorTurboModule 静态 instance 在模块重建时不清理旧监听器

**位置**：`turbomodules/ConnectorTurboModule.kt:85-88`

```kotlin
init {
    instance = this
    bindConnectorEvents()
}
```

**问题**：RN 重启时会创建新的 `ConnectorTurboModule` 实例，`init` 中调用 `bindConnectorEvents()` 会先调用 `removeStreamListener?.invoke()` 解绑旧监听器，但此时 `removeStreamListener` 是新实例的字段（为 `null`），旧实例的监听器不会被解绑。旧实例持有的 `connector.onStream` 回调仍然存活，会向已失效的 `reactApplicationContext` 发送事件，导致崩溃或内存泄漏。

**建议**：在 `invalidate()` 中显式调用 `removeStreamListener?.invoke()` 和 `removePassiveListener?.invoke()`，并将 `instance` 置为 `null`。

---

### [HIGH] H4 — ScriptsTurboModule.invokeNativeFunction 在单线程 Executor 上阻塞等待 JS 回调，存在死锁风险

**位置**：`turbomodules/ScriptsTurboModule.kt:182`

```kotlin
val completed = pendingCall.latch.await(timeoutMs, TimeUnit.MILLISECONDS)
```

**问题**：`invokeNativeFunction` 在 `scriptExecutor`（单线程）上执行，调用 `latch.await` 阻塞等待 JS 通过 `resolveNativeCall` 回调。但 `scriptExecutor` 是 `newSingleThreadExecutor`，如果脚本中连续发起多个 native 函数调用，第二个调用会被 Executor 队列阻塞，永远无法执行，导致第一个 `latch.await` 永远不会被 `countDown`，形成死锁。

**建议**：将 native 函数调用改为异步回调模式，不在 Executor 线程上阻塞；或使用多线程 Executor 允许并发执行。

---

### [MEDIUM] M1 — HotUpdateTurboModule.downloadPackage 在主线程执行，会阻塞 UI

**位置**：`turbomodules/HotUpdateTurboModule.kt:35`

```kotlin
runCatching {
    // 同步下载、解压、SHA 校验...
    URL(packageUrl).openStream().use { ... }
```

**问题**：`downloadPackage` 整个下载+解压+校验流程是同步执行的，没有切换到后台线程。TurboModule 方法默认在 JS 线程（NativeModules queue）执行，长时间阻塞会导致 JS 线程卡死，所有 JS 调用排队等待，UI 完全无响应。

**建议**：将下载逻辑切换到 `Dispatchers.IO` 协程或独立线程池执行，完成后再回调 Promise。

---

### [MEDIUM] M2 — AppRestartManager 持有 MainActivity 强引用，Activity 销毁后不释放

**位置**：`restart/AppRestartManager.kt:29`

```kotlin
class AppRestartManager(private val activity: MainActivity) {
```

**问题**：`AppRestartManager` 作为 `MainActivity` 的成员变量，同时又持有 `activity` 强引用。虽然 `AppRestartManager` 的生命周期与 `MainActivity` 相同，但 `restart()` 中的 `mainHandler.postDelayed` lambda 也捕获了 `activity`，若 Activity 在延迟期间被销毁，lambda 仍持有其引用。

**建议**：在 lambda 中改用 `WeakReference<MainActivity>`，执行前检查引用有效性。

---

### [MEDIUM] M3 — SecondaryProcessController.secondaryAlive 跨进程状态不同步

**位置**：`startup/SecondaryProcessController.kt:33`

```kotlin
private val secondaryAlive = AtomicBoolean(false)
```

**问题**：`SecondaryProcessController` 是 `object` 单例，`secondaryAlive` 是进程内状态。主进程和副进程各有独立的 JVM 实例，副进程调用 `markSecondaryStarted()` 只更新副进程内的 `secondaryAlive`，主进程的 `secondaryAlive` 永远是 `false`。`requestShutdownIfNeeded` 中的 `secondaryAlive.get()` 在主进程中永远返回 `false`，导致该判断完全失效，只能依赖 `hasSecondaryInstance` 参数。

**建议**：移除 `secondaryAlive` 的跨进程语义假设，明确注释该字段仅在副进程内有效；主进程的副屏存活状态应完全依赖 `SecondaryDisplayLauncher.isSecondaryActive`。

---

### [MEDIUM] M4 — HotUpdateTurboModule.readActiveMarker 将所有字段强转为 String，丢失类型信息

**位置**：`turbomodules/HotUpdateTurboModule.kt:147`

```kotlin
marker.keys().forEach { key ->
    putString(key, marker.opt(key)?.toString())
}
```

**问题**：`bootAttempt`、`maxLaunchFailures`、`updatedAt` 等字段是数字类型，被强转为 String 后，JS 层拿到的是字符串 `"0"` 而非数字 `0`，需要额外解析。这与 `writeBootMarker` 写入时的类型不一致，容易在 JS 层产生类型错误。

**建议**：根据字段实际类型调用对应的 `putInt`/`putDouble`/`putString`，或使用 `Arguments.fromBundle` 等工具方法。

---

### [MEDIUM] M5 — StartupOverlayManager.detach 用 context 引用比较判断 Activity，不可靠

**位置**：`startup/StartupOverlayManager.kt:116`

```kotlin
if (overlay.context === activity) {
    removeOverlay(overlay)
}
```

**问题**：`overlay.context` 可能是 `ContextThemeWrapper` 而非 Activity 本身，`===` 引用比较会失败，导致 Activity 销毁时遮罩 View 未被移除，产生 `WindowLeaked` 异常。

**建议**：改用 `(overlay.context as? Activity) === activity` 或通过 `activityRef?.get() === activity` 判断。

---

### [LOW] L1 — AndroidManifest 中 android:usesCleartextTraffic="true"，允许明文 HTTP

**位置**：`android/app/src/main/AndroidManifest.xml:11`

```xml
android:usesCleartextTraffic="true"
```

**问题**：全局允许明文 HTTP 流量，与 C1 中热更新下载的安全风险叠加。即使 `network_security_config.xml` 有额外限制，全局标志仍会影响未被配置覆盖的域名。

**建议**：将 `usesCleartextTraffic` 改为 `false`，仅在 `network_security_config.xml` 中为开发环境域名（如 Metro bundler）显式开放。

---

### [LOW] L2 — MainApplication.currentProcessName() 读取 /proc 文件，在部分 ROM 上可能失败

**位置**：`MainApplication.kt:150-155`

```kotlin
File("/proc/${Process.myPid()}/cmdline")
    .readText(Charsets.UTF_8)
    .trim { it <= ' ' }
```

**问题**：`/proc/[pid]/cmdline` 在 Android 上通常可读，但部分加固 ROM 或沙箱环境会限制访问。`runCatching.getOrDefault(packageName)` 的 fallback 是包名，而非进程名，会导致副进程被误判为主进程，加载错误的 bundle。

**建议**：优先使用 `ActivityManager.getRunningAppProcesses()` 或 `Application.getProcessName()`（API 28+）获取进程名，`/proc` 读取作为最后 fallback。

---

### [LOW] L3 — AppRestartManager 重启失败时显示 Toast，不适合 Kiosk 场景

**位置**：`restart/AppRestartManager.kt:76-79`

```kotlin
Toast.makeText(activity, "重启失败，请重试", Toast.LENGTH_LONG).show()
```

**问题**：Toast 是面向用户的提示，在 Kiosk/POS 场景下不应直接暴露给终端用户。且 Toast 文案硬编码为中文，不支持国际化。

**建议**：通过 JS 事件通知上层处理错误展示，或至少将文案提取到 strings.xml。

---

## 三、设计层面问题

### D1 — 热更新链路缺少完整性验证闭环

`HotUpdateTurboModule.downloadPackage` 接收的 `packageSha256` 和 `manifestSha256` 均来自 JS 层参数，没有服务端签名验证。攻击者若能控制 JS 代码（如通过旧版 bundle 漏洞），可以同时伪造下载 URL 和 SHA 值，绕过完整性校验。

**建议**：SHA 值应来自服务端下发的签名清单，由原生层独立验证签名，不依赖 JS 传入。

---

### D2 — StartupCoordinator 的 startupMode 状态在重启后未正确重置

**位置**：`startup/StartupCoordinator.kt:73`

```kotlin
startupMode = StartupMode.COLD_START  // 在 onAppLoadComplete 末尾重置
```

`onAppLoadComplete` 末尾将 `startupMode` 重置为 `COLD_START`，但这发生在 `scheduleOverlayHide` 和 `scheduleSecondaryStart` 之后。若重启流程在 `onAppLoadComplete` 执行期间触发 `beginRestart`，`startupMode` 会被先设为 `RESTART`，然后被 `onAppLoadComplete` 末尾的赋值覆盖回 `COLD_START`，导致下一轮重启时错误地显示启动遮罩。

---

## 四、缺失测试覆盖

| 文件 | 缺失测试的关键逻辑 |
|---|---|
| `HotUpdateBootMarkerStore` | `preparePrimaryBoot` 超限回滚、并发锁保护 |
| `HotUpdateBundleResolver` | bundle 文件缺失时的回滚触发 |
| `StartupCoordinator` | 重启中途 `onAppLoadComplete` 的竞态 |
| `SecondaryProcessController` | ACK 超时流程、重复 shutdown 请求 |
| `ScriptsTurboModule` | `invalidate` 时 pending call 的清理 |

---

## 五、优先级汇总

| 级别 | 编号 | 问题 |
|------|------|------|
| CRITICAL | C1 | 热更新下载不强制 HTTPS，存在中间人攻击风险 |
| CRITICAL | C2 | HotUpdateBootMarkerStore 文件锁在同进程内不互斥 |
| HIGH | H1 | MainActivity.instance 空窗期导致启动编排卡死 |
| HIGH | H2 | StartupCoordinator pending 字段无同步保护 |
| HIGH | H3 | ConnectorTurboModule 重建时旧监听器未解绑 |
| HIGH | H4 | ScriptsTurboModule 单线程 Executor 阻塞等待，死锁风险 |
| MEDIUM | M1 | HotUpdateTurboModule 下载在 JS 线程同步执行，阻塞 UI |
| MEDIUM | M2 | AppRestartManager lambda 捕获 Activity 强引用 |
| MEDIUM | M3 | SecondaryProcessController.secondaryAlive 跨进程语义错误 |
| MEDIUM | M4 | readActiveMarker 将数字字段强转为 String |
| MEDIUM | M5 | StartupOverlayManager.detach context 比较不可靠 |
| LOW | L1 | AndroidManifest 全局允许明文 HTTP |
| LOW | L2 | currentProcessName() 读取 /proc 在部分 ROM 上失败 |
| LOW | L3 | 重启失败 Toast 硬编码中文，不适合 Kiosk 场景 |
