# 2-ui/2.1-base 与 2-ui/2.3-integration 代码审查报告

**日期：** 2026-04-17  
**范围：** `2-ui/2.1-base`（runtime-react、input-runtime、admin-console、terminal-console）和 `2-ui/2.3-integration/retail-shell`  
**方法：** 全量阅读源码，从设计合理性、BUG、安全性、性能、可维护性角度逐一分析

---

## 一、包结构总览

| 包 | 职责 |
|----|------|
| `runtime-react` | UI 运行时 React 层：屏幕容器、overlay、alert、renderer 注册表 |
| `input-runtime` | 虚拟键盘输入运行时：InputField、VirtualKeyboardOverlay、InputRuntimeContext |
| `admin-console` | 管理员控制台：登录、工作台、适配器诊断、各 section |
| `terminal-console` | 终端控制台：激活屏幕、连接摘要 |
| `retail-shell` | 零售壳层集成：根屏路由、TCP 生命周期 actor |

---

## 二、设计问题

### 问题 1：`rendererRegistry` 使用模块级单例 —— 测试污染与多实例冲突

**位置：** `runtime-react/src/foundations/rendererRegistry.ts:44-58`

**问题描述：**

```ts
const sharedRendererRegistry = createRendererRegistry()  // 模块级单例

export const getSharedRendererRegistry = () => sharedRendererRegistry
export const registerUiRendererParts = (...) => sharedRendererRegistry.registerParts(parts)
export const resolveUiRenderer = (...) => sharedRendererRegistry.resolve(rendererKey)
export const clearUiRendererRegistry = () => sharedRendererRegistry.clear()
```

同样的模式在 `admin-console/src/supports/adminSectionRegistry.tsx` 中也存在（`sharedAdminConsoleSectionRegistry`），以及 `adapterDiagnosticsRuntime` 中也有类似单例。

**影响：**
1. 多个测试用例共享同一个注册表，前一个测试注册的 renderer 会污染后一个测试，即使调用了 `clearUiRendererRegistry()` 也依赖测试顺序
2. 如果同一进程中存在多个 `UiRuntimeRootShell` 实例（如多屏场景），它们共享同一个注册表，无法独立配置
3. 与项目多屏独立运行的设计目标（CLAUDE.md 中的多进程方案）存在潜在冲突

**建议：** 将注册表实例通过 React Context 注入，而不是使用模块级单例。`createRendererRegistry()` 已经存在，只需在 `UiRuntimeProvider` 中创建并通过 context 传递。

---

### 问题 2：`AdminPopup` 直接调用 `useStore()` 并手动订阅 store —— 绕过 React-Redux 响应式机制

**位置：** `admin-console/src/ui/modals/AdminPopup.tsx:8,113`

```ts
import {useStore} from 'react-redux'
const store = useStore() as EnhancedStore
// ...
activeSection?.render({ runtime, store, closePanel })
```

**位置：** `admin-console/src/ui/screens/AdminTerminalSection.tsx:46-58`

```ts
useEffect(() => {
    const updateSnapshot = () => {
        const state = store.getState()
        setSnapshot({ ... })
    }
    updateSnapshot()
    return store.subscribe(updateSnapshot)
}, [store])
```

**影响：**
1. `AdminPopup` 把原始 `store` 传给 `render()` 回调，section 组件可以任意 dispatch，完全绕过正常的 Redux 数据流
2. `AdminTerminalSection` 手动订阅 store 并用 `useState` 管理快照，这是 React-Redux 出现之前的反模式。每次 store 变化都会触发 `setSnapshot`，即使相关 slice 没有变化也会重渲染
3. `refreshSnapshot` 函数（第 60-68 行）与 `useEffect` 中的 `updateSnapshot` 逻辑完全重复

**建议：** 用 `useSelector` 替代手动订阅；section 的 `render` 回调不应接收原始 `store`，改为接收 `dispatchCommand` 等受控接口。

---

### 问题 3：`adminPasswordVerifier` 密码算法安全性极低

**位置：** `admin-console/src/supports/adminPasswordVerifier.ts`

**问题描述：**

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

这是一个自制的非密码学哈希函数，用于生成管理员动态密码：
1. 使用简单的多项式滚动哈希（乘数 131），极易碰撞和逆推
2. 输出只有 6 位数字（100 万种可能），暴力枚举成本极低
3. 时间窗口允许前后各 1 小时（`[-1, 0, 1]`），有效窗口 3 小时，进一步降低攻击难度
4. 在 DEV 模式下直接在 UI 上显示当前密码（`passwordPlaceholder` 逻辑），如果 DEV 模式判断有误，会在生产环境泄露密码

**建议：** 使用 HMAC-SHA256 或 TOTP（RFC 6238）标准算法替代自制哈希；DEV 模式密码提示应通过独立的调试工具提供，而不是嵌入 UI 组件。

---

### 问题 4：`InputRuntimeContext` 的 `applyVirtualKey` 在 setState 回调中调用外部副作用

**位置：** `input-runtime/src/contexts/InputRuntimeContext.tsx:67-88`

```ts
const applyVirtualKey = useCallback((key: VirtualKeyboardKey) => {
    setActiveInput(current => {
        if (!current) return current
        if (key === 'close') return null

        const nextValue = applyVirtualKeyToValue(...)
        if (nextValue !== current.value) {
            current.onChangeText(nextValue)  // ← 在 setState 回调中调用外部副作用
        }
        return key === 'enter' ? null : { ...current, value: nextValue }
    })
}, [])
```

**影响：**
React 的 `setState` 函数式更新回调（`setActiveInput(current => ...)`）应该是纯函数，不能有副作用。`current.onChangeText(nextValue)` 是外部副作用（通知父组件值变化），在此处调用违反了 React 的规则：
1. 在 React 18 严格模式下，setState 回调可能被调用两次，导致 `onChangeText` 被调用两次
2. 如果 `onChangeText` 触发了状态更新，可能导致循环渲染

**建议：** 将副作用移出 setState 回调，改用 `useEffect` 监听 `activeInput.value` 变化后再调用 `onChangeText`，或者先计算 nextValue 再分两步执行 setState 和副作用。

---

### 问题 5：`VirtualKeyboardOverlay` 硬编码中文文案 —— 国际化缺失

**位置：** `input-runtime/src/ui/components/VirtualKeyboardOverlay.tsx:40-45,137,198`

```ts
const getKeyLabel = (key: VirtualKeyboardKey): string => {
    if (key === 'backspace') return '退格'
    if (key === 'clear') return '清空'
    return key
}
// ...
<Text>关闭</Text>
<Text>{layout.enterLabel ?? '完成'}</Text>
```

整个 `VirtualKeyboardOverlay` 组件以及 `AdminPopup` 中的所有文案都是硬编码的中文字符串，没有国际化支持。项目 CLAUDE.md 中提到"业界通用的产品"，但 UI 层完全不支持多语言。

**建议：** 引入 i18n 方案（如 `react-i18next`），将所有 UI 文案提取为翻译键。

---

### 问题 6：`ScreenContainer` 在 renderer 缺失时静默渲染 `EmptyScreen` —— 调试困难

**位置：** `runtime-react/src/ui/components/ScreenContainer.tsx:13-19`

```ts
const child = useChildScreenPart(containerPart)
if (!child) {
    return (
        <View style={{flex: 1}}>
            <EmptyScreen />
        </View>
    )
}
```

当 `resolveUiRenderer(entry.rendererKey)` 返回 `null` 时（renderer 未注册），`useChildScreenPart` 返回 `null`，`ScreenContainer` 静默渲染空屏幕。开发者无法从 UI 或日志中得知是哪个 `rendererKey` 缺失。

**建议：** 在 DEV 模式下，当 renderer 缺失时抛出错误或渲染错误提示屏幕，显示缺失的 `rendererKey` 和 `containerPart`。

---

### 问题 7：`replaceRetailShellRootScreen` 串行 dispatch 两个 `replaceScreen` 命令 —— 性能浪费

**位置：** `retail-shell/src/supports/rootScreenRouter.ts:25-40`

```ts
await context.dispatchCommand(createCommand(
    uiRuntimeV2CommandDefinitions.replaceScreen,
    { definition: primaryTarget.definition, ... }
))
await context.dispatchCommand(createCommand(
    uiRuntimeV2CommandDefinitions.replaceScreen,
    { definition: secondaryTarget.definition, ... }
))
```

两个 `replaceScreen` 命令是独立的（分别操作 primary 和 secondary 容器），但用 `await` 串行执行。如果每个命令耗时 50ms，总耗时 100ms；并行执行只需 50ms。

**建议：** 用 `Promise.all` 并行 dispatch：
```ts
await Promise.all([
    context.dispatchCommand(createCommand(...primaryTarget...)),
    context.dispatchCommand(createCommand(...secondaryTarget...)),
])
```

---

## 三、潜在 BUG

### BUG 1：`normalizeAmountValue` 允许多个小数点

**位置：** `input-runtime/src/supports/inputController.ts:8-19`

```ts
const normalizeAmountValue = (value: string, key: string): string => {
    if (key === '.') {
        return value.includes('.') ? value : `${value || '0'}.`
    }
    if (key === '-') {
        return value.startsWith('-') ? value.slice(1) : `-${value}`
    }
    return `${value}${key}`
}
```

**问题：** 当 `key` 不是 `.` 或 `-` 时，直接拼接 `${value}${key}`。如果用户先输入 `1.2`，再输入 `.`，会被第 10 行拦截返回 `1.2`（正确）。但如果用户输入 `1.2` 后输入数字 `3`，会走到第 15 行返回 `1.23`（正确）。然而，如果键盘布局配置错误，允许用户在已有小数点后再次输入 `.`，第 10 行会拦截，但如果用户通过其他方式（如粘贴）输入 `1.2.3`，这个函数不会校验。

更严重的是：`key === '-'` 的逻辑允许在任意位置切换正负号，包括 `1.2` → `-1.2` 或 `-1.2` → `1.2`，但没有阻止 `1-2` 这样的非法输入（如果 `-` 键在数字键盘中可用）。

**建议：** 在 `normalizeAmountValue` 末尾添加正则校验，确保返回值符合 `/^-?\d*\.?\d*$/`。

---

### BUG 2：`AdminTerminalSection` 的 `deactivate` 函数在 async IIFE 中但未处理组件卸载

**位置：** `admin-console/src/ui/screens/AdminTerminalSection.tsx:70-92`

```ts
const deactivate = () => {
    void (async () => {
        setLoading(true)
        setMessage('')
        try {
            const result = await runtime.dispatchCommand(...)
            refreshSnapshot()
            if (result.status === 'COMPLETED') {
                setMessage('终端已注销激活')
                closePanel?.()
            } else {
                setMessage('注销激活未完成')
            }
        } catch (error) {
            setMessage(...)
        } finally {
            setLoading(false)
        }
    })()
}
```

**问题：** 如果用户点击"注销激活"后立即关闭 AdminPopup（如点击外层关闭按钮），组件卸载，但 async 函数仍在执行。当 `dispatchCommand` 完成后，`setLoading(false)` 和 `setMessage(...)` 会在已卸载的组件上调用，触发 React 警告："Can't perform a React state update on an unmounted component"。

**建议：** 使用 `useRef` 跟踪组件挂载状态，或使用 AbortController 取消异步操作。

---

### BUG 3：`AdapterDiagnosticsScreen` 的 `handleRunAll` 未处理并发点击

**位置：** `admin-console/src/ui/screens/AdapterDiagnosticsScreen.tsx:39-51`

```ts
const handleRunAll = async () => {
    if (isRunning) return
    setRunning(true)
    ...
}
```

**问题：** 在 React 18 并发模式下，如果用户快速双击"一键测试"按钮，两次点击可能在 `setRunning(true)` 生效前都通过了 `if (isRunning)` 检查，导致 `controller.runAll()` 被调用两次。

**建议：** 用 `useRef` 存储 running 状态作为同步锁：
```ts
const runningRef = useRef(false)
const handleRunAll = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    try { ... } finally {
        runningRef.current = false
        setRunning(false)
    }
}
```

---

### BUG 4：`toSummary` 中全部 skipped 时 status 错误为 `'passed'`

**位置：** `admin-console/src/supports/adapterDiagnostics.ts:60`

```ts
status: failed > 0 ? 'failed' : 'passed',
```

当所有场景都是 `skipped`（`failed === 0`），`status` 会被设为 `'passed'`，但实际上没有任何场景真正通过测试。这会在 UI 上显示"通过"，误导运维人员。

**建议：** 修正逻辑：
```ts
status: failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'skipped',
```

---

## 五、代码质量问题

### 质量问题 1：`AdminPopup` 组件超过 395 行，内联了大量样式

**位置：** `admin-console/src/ui/modals/AdminPopup.tsx`

整个文件 395 行，其中大量是内联 style 对象。每次渲染都会创建新的 style 对象，增加 GC 压力。同时，`Shell`、`Action` 等子组件定义在文件内部，但没有用 `React.memo` 包裹，每次父组件渲染都会重新渲染。

**建议：** 将 style 提取为 `StyleSheet.create()`（React Native 最佳实践），将子组件移到独立文件或用 `React.memo` 包裹。

---

### 质量问题 2：`AdminPopup` 中 `boxShadow` 使用 Web 语法

**位置：** `admin-console/src/ui/modals/AdminPopup.tsx:337`

```ts
boxShadow: selected
    ? '0px 10px 20px rgba(11, 95, 255, 0.18)'
    : 'none',
```

`boxShadow` 是 Web CSS 属性，React Native 不支持（RN 使用 `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` 或 `elevation`）。这段代码在 React Native 裸工程中会被静默忽略，阴影效果不会生效。

**建议：** 替换为 React Native 兼容的阴影属性：
```ts
shadowColor: selected ? 'rgba(11, 95, 255, 0.18)' : 'transparent',
shadowOffset: {width: 0, height: 10},
shadowOpacity: 1,
shadowRadius: 20,
elevation: selected ? 8 : 0,
```

---

### 质量问题 3：`InputField` 中 `usesVirtualKeyboard(mode)` 被调用两次

**位置：** `input-runtime/src/ui/components/InputField.tsx:39,64`

```ts
const isVirtual = usesVirtualKeyboard(mode)  // 第 39 行

// ...

if (usesVirtualKeyboard(mode)) {  // 第 64 行，重复调用
```

第 64 行应直接使用已计算的 `isVirtual` 变量，而不是重复调用函数。

**建议：** 将第 64 行改为 `if (isVirtual) {`。

---

### 质量问题 4：`retail-shell` 的 `runtimeInitializeActor` 硬编码 `displayIndex > 0` 判断副屏

**位置：** `retail-shell/src/features/actors/runtimeInitializeActor.ts:16-21`

```ts
if ((context.displayContext.displayIndex ?? 0) > 0) {
    return {
        skipped: true,
        reason: 'secondary-display-follows-master-ui-state',
    }
}
```

副屏跳过初始化的逻辑通过 `displayIndex > 0` 硬编码判断。如果未来出现三屏或更复杂的显示拓扑，这个判断可能不够准确。`displayContext` 中已有 `displayCount` 字段，但未被使用。

**建议：** 将副屏判断逻辑抽象为 `isSecondaryDisplay(displayContext)` 工具函数，集中维护判断规则。

---

## 六、问题汇总与优先级

| # | 类型 | 问题 | 严重程度 |
|---|------|------|----------|
| 1 | 设计 | 模块级单例注册表，测试污染与多实例冲突 | 高 |
| 2 | 设计 | AdminPopup 直接使用 useStore() 绕过 React-Redux | 高 |
| 3 | 安全 | 管理员密码使用自制弱哈希算法 | 高 |
| 4 | BUG | applyVirtualKey 在 setState 回调中调用外部副作用 | 高 |
| 5 | BUG | deactivate 未处理组件卸载后的 setState | 中 |
| 6 | BUG | toSummary 全部 skipped 时 status 错误为 passed | 中 |
| 7 | BUG | handleRunAll 未防并发双击 | 中 |
| 8 | 质量 | boxShadow 使用 Web 语法，RN 中静默失效 | 中 |
| 9 | 设计 | renderer 缺失时静默渲染空屏，调试困难 | 中 |
| 10 | 性能 | replaceScreen 串行 dispatch，应并行 | 低 |
| 11 | 性能 | VirtualKeyboard 按钮未 memo，每次输入全量重渲染 | 低 |
| 12 | 质量 | usesVirtualKeyboard 重复调用 | 低 |
| 13 | 设计 | 所有 UI 文案硬编码中文，无国际化支持 | 低 |
| 14 | 设计 | displayIndex > 0 硬编码副屏判断 | 低 |

---

## 七、总体评价

UI 层整体架构清晰，`runtime-react` / `input-runtime` / `admin-console` 的职责划分合理，虚拟键盘的设计思路（InputRuntimeContext + VirtualKeyboardOverlay 解耦）也是正确的。主要问题集中在：

1. **安全性**（问题 3）：管理员密码算法必须替换，这是最高优先级
2. **React 规范违反**（问题 4）：setState 回调中的副作用在严格模式下会产生 BUG
3. **单例注册表**（问题 1）：在多屏场景下会成为架构瓶颈
4. **React Native 兼容性**（问题 8）：`boxShadow` 在 RN 中静默失效，与 CLAUDE.md 中"100% 兼容 React Native 裸工程"的要求相悖


### BUG 3：`AdapterDiagnosticsScreen` 的 `handleRunAll` 未处理并发点击

**位置：** `admin-console/src/ui/screens/AdapterDiagnosticsScreen.tsx:39-51`

```ts
const handleRunAll = async () => {
    if (isRunning) return
    setRunning(true)
    try {
        const summary = await controller.runAll()
        store.dispatch(adminConsoleStateActions.setLatestAdapterSummary(summary))
        setLastMessage(`已完成 ${summary.total} 项测试`)
    } finally {
        setRunning(false)
    }
}
```

**问题：** 虽然有 `if (isRunning) return` 保护，但在 React 18 并发模式下，如果用户快速双击"一键测试"按钮，两次点击可能在 `setRunning(true)` 生效前都通过了 `if (isRunning)` 检查，导致 `controller.runAll()` 被调用两次。

**建议：** 用 `useRef` 存储 running 状态，或在按钮上添加 `disabled={isRunning}` 的同时用 `useTransition` 防止并发。

---

## 四、性能问题

### 性能问题 1：`AdminPopup` 每次渲染都重新创建 `verifier`

**位置：** `admin-console/src/ui/modals/AdminPopup.tsx:115-117`

```ts
const verifier = useMemo(() => createAdminPasswordVerifier({
    deviceIdProvider: () => deviceId,
}), [deviceId])
```

`deviceId` 是 prop，通常不会变化。但 `useMemo` 的依赖是 `[deviceId]`，如果父组件每次渲染都传入新的 `deviceId` 字符串（即使值相同），`verifier` 会被重新创建。虽然 `createAdminPasswordVerifier` 本身很轻量，但这是一个常见的 React 性能反模式。

**建议：** 如果 `deviceId` 确实不变，可以用 `useRef` 存储 verifier；或者确保父组件不会传入新的字符串引用。

---

### 性能问题 2：`VirtualKeyboardOverlay` 的 `layout.rows.map` 在每次渲染时重新创建所有按钮

**位置：** `input-runtime/src/ui/components/VirtualKeyboardOverlay.tsx:140-179`

虚拟键盘有 3-4 行按钮，每行 3-4 个按钮，共约 12-16 个 `Pressable` 组件。每次 `activeInput.value` 变化（用户输入一个字符），整个 `VirtualKeyboardOverlay` 重新渲染，所有按钮的 `style` 函数都会重新执行。

**建议：** 将单个按钮提取为独立的 `React.memo` 组件，避免不必要的重渲染。

---
