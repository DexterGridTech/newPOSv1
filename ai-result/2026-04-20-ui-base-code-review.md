# 2-ui/2.1-base 代码审查报告

**日期**：2026-04-20  
**审查范围**：`2-ui/2.1-base` 下所有包  
**包列表**：runtime-react、input-runtime、admin-console、terminal-console

---

## 一、总体评价

整体结构清晰，分层合理，类型系统使用较规范。但存在以下几类问题：安全性严重隐患、全局可变状态滥用、React Hook 使用错误、设计不一致、以及部分逻辑缺陷。

---

## 二、问题清单

### [CRITICAL] C1 — adminPasswordVerifier 使用弱哈希算法，密码可被逆向

**位置**：`admin-console/src/supports/adminPasswordVerifier.ts:11-18`

```ts
const deriveNumericTail = (seed: string): string => {
    let hash = 0
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 131 + seed.charCodeAt(index)) >>> 0
    }
    const numeric = `${hash}${seed.length * 97}`
    return numeric.slice(-6).padStart(6, '0')
}
```

**问题**：管理员密码由 `deviceId + 小时时间戳` 经过一个简单的多项式哈希推导而来，输出仅 6 位数字（100 万种可能）。该算法：
1. 不是密码学安全哈希（无 salt、无 HMAC）
2. 输出空间极小，可在毫秒内暴力枚举
3. 知道 deviceId 的人可以直接计算出当前有效密码
4. `verify` 允许前后各 1 小时的密码有效（3 小时窗口），进一步降低安全性

**建议**：使用 HMAC-SHA256 或 TOTP（RFC 6238）标准算法，或改为服务端下发一次性密码。

---

### [CRITICAL] C2 — adminPasswordVerifier.deviceIdProvider 类型声明支持异步但实现强制同步

**位置**：`admin-console/src/supports/adminPasswordVerifier.ts:21-50`

```ts
deviceIdProvider: () => Promise<string> | string
// ...
const deviceId = input.deviceIdProvider()
if (typeof deviceId !== 'string') {
    throw new Error('[ui-base-admin-console] deriveFor requires a synchronous deviceIdProvider')
}
```

**问题**：接口类型声明 `deviceIdProvider` 可以返回 `Promise<string>`，但实现中如果返回 Promise 就直接抛出错误。这是一个类型欺骗——类型系统告诉调用方可以传异步函数，但运行时会崩溃。调用方无法从类型签名中得知这个限制。

**建议**：将类型改为 `deviceIdProvider: () => string`，明确只支持同步；或将 `deriveFor`/`verify` 改为 `async` 方法。

---

### [HIGH] H1 — rendererRegistry 使用模块级全局单例，测试污染风险高

**位置**：`runtime-react/src/foundations/rendererRegistry.ts:44-58`

```ts
const sharedRendererRegistry = createRendererRegistry()

export const getSharedRendererRegistry = () => sharedRendererRegistry
export const registerUiRendererParts = (...) => sharedRendererRegistry.registerParts(parts)
export const resolveUiRenderer = (...) => sharedRendererRegistry.resolve(rendererKey)
export const clearUiRendererRegistry = () => { sharedRendererRegistry.clear() }
```

**问题**：模块级全局单例在多测试用例并发或顺序执行时会相互污染。虽然提供了 `clearUiRendererRegistry`，但依赖调用方手动清理是脆弱的。同样的模式在 `adminHostToolsRegistry.ts` 和 `adapterDiagnosticsRuntime.ts` 中重复出现，形成系统性问题。

**建议**：通过 React Context 或依赖注入传递 registry 实例，避免模块级全局状态。

---

### [HIGH] H2 — useInputController 中 controller 与 state 状态不同步

**位置**：`input-runtime/src/hooks/useInputController.ts:27`

```ts
const controller = useMemo(() => createInputController(state), [])
```

**问题**：`createInputController(state)` 在初始化时捕获了 `state` 的快照，但 `useMemo` 依赖数组为空 `[]`，意味着 controller 永远不会随 `state` 更新而重建。如果 `input.mode`、`input.maxLength` 等参数在组件生命周期内发生变化，controller 内部状态与外部 state 会产生不一致。

此外，`setValue`/`applyVirtualKey`/`clear` 方法在每次渲染时都会重新创建（未用 `useCallback` 包裹），导致不必要的子组件重渲染。

**建议**：将 controller 的状态完全内化（不依赖外部 state 初始化），或在依赖数组中加入关键参数；同时用 `useCallback` 包裹暴露的方法。

---

### [HIGH] H3 — useAdminPopupState 中 setSelectedTab 未被 useCallback 包裹，每次渲染重建

**位置**：`admin-console/src/hooks/useAdminPopupState.ts:17-19`

```ts
const setSelectedTab = (tab: AdminConsoleTab) => {
    dispatch(adminConsoleStateActions.setSelectedTab(tab))
}

return useMemo(() => ({
    ...
    setSelectedTab,
    ...
}), [error, password, screen, selectedTab])
```

**问题**：`setSelectedTab` 在每次渲染时都是新函数引用，但 `useMemo` 的依赖数组中没有包含它（因为它不是稳定引用）。这导致每次 `error/password/screen/selectedTab` 任一变化时，`setSelectedTab` 都是新函数，破坏了 memo 的稳定性。

**建议**：用 `useCallback` 包裹 `setSelectedTab`，并将其加入 `useMemo` 依赖数组。

---

### [HIGH] H4 — useScreenPartsByContainer 中 useMemo 对 selector 结果无意义

**位置**：`runtime-react/src/hooks/useScreenPartsByContainer.ts:17-21`

```ts
const definitions = useSelector<RootState, readonly UiScreenDefinition[]>((state) =>
    selectUiScreenDefinitionsByContainer(state, containerKey),
)
return useMemo(() => definitions, [definitions])
```

**问题**：`useMemo(() => definitions, [definitions])` 完全没有意义——当 `definitions` 引用变化时，memo 也会重新计算并返回新引用，与直接返回 `definitions` 效果完全相同。这是对 `useMemo` 的误用，增加了无谓的开销和代码噪音。

**建议**：直接 `return definitions`，或在 selector 层面使用 `shallowEqual` 避免不必要的重渲染。

---

### [MEDIUM] M1 — inputIds.ts 使用模块级可变计数器，Hot Reload 后 ID 重置

**位置**：`input-runtime/src/supports/inputIds.ts`

```ts
let nextInputSequence = 0

export const createInputRuntimeId = (prefix = 'input'): string => {
    nextInputSequence += 1
    return `ui-base-input-runtime:${prefix}:${nextInputSequence}`
}
```

**问题**：模块级可变变量在 React Native 的 Fast Refresh（Hot Reload）场景下会被重置为 0，导致 ID 从头开始计数，可能与已存在的组件 ID 碰撞。此外，在 SSR 或多实例场景下也会产生问题。

**建议**：使用 `crypto.randomUUID()` 或基于时间戳+随机数的方案，避免依赖模块级计数器。

---

### [MEDIUM] M2 — defineInputField 是恒等函数，无实际价值

**位置**：`input-runtime/src/foundations/inputFieldFactory.ts:15-20`

```ts
export const defineInputField = (
    input: InputFieldDefinition,
): InputFieldDefinition => ({
    ...input,
    persistence: input.persistence ?? 'transient',
})
```

**问题**：该函数仅做一件事：为 `persistence` 设置默认值。但 `InputFieldDefinition` 接口中 `persistence` 已是可选字段，调用方完全可以直接写对象字面量。这个工厂函数没有提供类型收窄、验证或任何额外保证，是无意义的抽象（与 kernel 层的 `createPlatformPorts` 问题相同）。

**建议**：删除此函数，或在其中加入字段合法性校验逻辑。

---

### [MEDIUM] M3 — VirtualKeyboardKey 字母顺序错乱，存在维护隐患

**位置**：`input-runtime/src/types/input.ts:17-64`

```ts
export type VirtualKeyboardKey =
    | ...
    | 'M'
    | 'S'   // S 在 N 之前，顺序错误
    | 'N'
    | 'O'
    | ...
```

**问题**：字母键 `S` 出现在 `M` 之后、`N` 之前，顺序明显错乱。这不影响运行时行为，但说明该类型是手动维护的，容易在后续修改时引入遗漏或重复。

**建议**：按字母顺序排列，或用程序化方式生成字母键列表。

---

### [MEDIUM] M4 — AdminTopologySharePayload 中 serverAddress 类型设计不合理

**位置**：`admin-console/src/types/admin.ts:157-167`

```ts
export interface AdminTopologySharePayload {
    serverAddress?: readonly {
        address: string
    }[]
    wsUrl?: string
    httpBaseUrl?: string
}
```

**问题**：`serverAddress` 是内联匿名对象数组，同时又有 `wsUrl` 和 `httpBaseUrl` 两个独立字段，三者语义重叠。`serverAddress` 中的对象只有 `address` 字段，没有协议类型区分，无法表达 ws 和 http 的差异。这个类型设计混乱，调用方不清楚应该用哪个字段。

**建议**：统一为一个结构，明确区分不同协议的地址，或提取 `ServerAddress` 接口。

---

### [MEDIUM] M5 — AdminConsoleSectionRenderContext 中使用内联 import() 类型

**位置**：`admin-console/src/types/admin.ts:188-191`

```ts
export interface AdminConsoleSectionRenderContext {
    runtime: import('@impos2/kernel-base-runtime-shell-v2').KernelRuntimeV2
    store: import('@reduxjs/toolkit').EnhancedStore
    closePanel: () => void
}
```

**问题**：在接口字段中使用内联 `import()` 类型是不规范的写法，应在文件顶部统一 import。内联 import 会降低可读性，且在某些工具链（如 API 文档生成器）中无法正确解析。

**建议**：在文件顶部添加 `import type { KernelRuntimeV2 } from '...'`。

---

### [MEDIUM] M6 — uiRuntimeRootVariables 缺少 defaultValue，与类型定义不一致

**位置**：`runtime-react/src/foundations/uiVariables.ts`

```ts
export const uiRuntimeRootVariables = {
    primaryRootContainer: {
        key: 'primary.root.container',
        persistence: 'recoverable',
        // 没有 defaultValue
    },
} satisfies Record<string, UiRuntimeVariable>
```

**问题**：`UiRuntimeVariable` 接口中 `defaultValue` 是可选的，但 `useUiVariableValue` 会将其传给 selector 作为默认值。当 `defaultValue` 未定义时，selector 返回 `undefined`，调用方需要额外处理 `undefined` 情况。对于根容器这类关键变量，缺少默认值会导致初始渲染时容器为空。

**建议**：为关键变量提供明确的 `defaultValue`。

---

### [LOW] L1 — DefaultAlert 无样式，不可用于生产

**位置**：`runtime-react/src/ui/components/DefaultAlert.tsx`

```tsx
export const DefaultAlert: React.FC<UiAlertInfo> = ({ title = '提示', message = '' }) => (
    <View testID="ui-base-default-alert">
        <Text>{title}</Text>
        <Text>{message}</Text>
    </View>
)
```

**问题**：DefaultAlert 完全没有样式，在生产环境中渲染出来是不可见或无法交互的（没有按钮、没有关闭逻辑）。作为"默认"组件，它应该至少提供基本的可用性，否则调用方不知道它是占位符还是有意为之。

**建议**：添加注释说明这是开发占位符，或提供基本样式和关闭按钮。

---

### [LOW] L2 — terminalFormatting.ts 中 formatTerminalTimestamp 的 !value 判断有误

**位置**：`terminal-console/src/supports/terminalFormatting.ts:28-35`

```ts
export const formatTerminalTimestamp = (
    value?: TimestampMs | number,
    fallback = '未记录',
): string => {
    if (!value || Number.isNaN(Number(value))) {
        return fallback
    }
    return formatTimestampMs(Number(value) as TimestampMs)
}
```

**问题**：`!value` 在 `value === 0` 时为 `true`，会错误地返回 fallback。虽然时间戳为 0 在实际中代表 Unix 纪元（1970-01-01），通常确实无意义，但这个判断方式不够明确，应显式检查。

**建议**：改为 `if (value === undefined || value === null || value === 0)`，意图更清晰。

---

### [LOW] L3 — adminLauncherTracker 的触发区域判断仅检查左上角

**位置**：`admin-console/src/supports/adminLauncherTracker.ts:17`

```ts
if (event.pageX > areaSize || event.pageY > areaSize) {
    return false
}
```

**问题**：触发区域被硬编码为屏幕左上角（0,0）到（areaSize, areaSize）的矩形。这意味着只有点击左上角才能触发管理员入口，但没有任何文档说明这个设计意图。如果屏幕有状态栏或安全区域偏移，实际可点击区域可能更小。

**建议**：添加注释说明设计意图，或支持配置触发区域的位置（不仅限于左上角）。

---

## 三、设计层面问题

### D1 — 三处全局单例模式不一致

`rendererRegistry`、`adminHostToolsRegistry`、`adapterDiagnosticsRuntime` 三处都使用了模块级全局单例模式，但实现方式略有不同：

- `rendererRegistry`：提供 `clear()` 方法
- `adminHostToolsRegistry`：提供 `reset()` 方法  
- `adapterDiagnosticsRuntime`：提供 `reset()` 方法但重置为默认值而非空值

这三处应统一为相同的模式，或统一改为依赖注入。

---

### D2 — UiModalPartDefinition 和 UiAlertPartDefinition 是无意义的类型别名

**位置**：`runtime-react/src/types/parts.ts:15-17`

```ts
export type UiModalPartDefinition<TProps = unknown> = UiScreenPartDefinition<TProps>
export type UiAlertPartDefinition<TProps = UiAlertInfo> = UiScreenPartDefinition<TProps>
```

两个类型别名与 `UiScreenPartDefinition` 完全相同（除了默认泛型参数），没有任何结构差异。`kind` 字段本应区分三种类型，但类型系统层面无法约束。

**建议**：用判别联合类型区分三种 part，或至少在 `kind` 字段上加入字面量类型约束。

---

## 四、缺失测试覆盖

| 包 | 缺失测试的关键逻辑 |
|---|---|
| `runtime-react` | `rendererRegistry`、`useEditableUiVariable`、`uiNavigationBridge` |
| `input-runtime` | `useInputController`（状态同步问题）、`inputPersistence` |
| `admin-console` | `adminLauncherTracker`（有测试但覆盖不完整）、`adapterDiagnosticsRuntime` |
| `terminal-console` | `terminalFormatting`、`terminalNavigation` |

---

## 五、优先级汇总

| 级别 | 编号 | 问题 |
|------|------|------|
| CRITICAL | C1 | adminPassword 使用弱哈希，可被暴力破解 |
| CRITICAL | C2 | deviceIdProvider 类型欺骗（声明异步但运行时强制同步） |
| HIGH | H1 | 三处全局单例，测试污染风险 |
| HIGH | H2 | useInputController 中 controller 与 state 不同步 |
| HIGH | H3 | useAdminPopupState 中 setSelectedTab 未稳定化 |
| HIGH | H4 | useScreenPartsByContainer 中 useMemo 无意义 |
| MEDIUM | M1 | inputIds 模块级计数器，Hot Reload 后重置 |
| MEDIUM | M2 | defineInputField 是恒等函数，无实际价值 |
| MEDIUM | M3 | VirtualKeyboardKey 字母顺序错乱 |
| MEDIUM | M4 | AdminTopologySharePayload 类型设计混乱 |
| MEDIUM | M5 | AdminConsoleSectionRenderContext 内联 import 类型 |
| MEDIUM | M6 | uiRuntimeRootVariables 缺少 defaultValue |
| LOW | L1 | DefaultAlert 无样式，不可用于生产 |
| LOW | L2 | formatTerminalTimestamp 的 !value 判断有误 |
| LOW | L3 | adminLauncherTracker 触发区域仅限左上角 |

