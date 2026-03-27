# Task Test Screen 实施计划

## 目标

在 `3-adapter/android/pos-adapter/dev` 中新增 Task 测试页面，支持：
1. 选择 testTask 目录下的 TaskDefinition 执行
2. 展示 TaskDefinition 详情
3. 实时打印所有 progressData，最新条目高亮显示
4. 新增摄像头扫码和 USB 扫码枪两个 TaskDefinition

---

## 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `dev/testTask/index.ts` | 静态注册列表，导出所有待测 TaskDefinition |
| `dev/testTask/readBarCodeFromCamera.ts` | 摄像头扫码 TaskDefinition |
| `dev/testTask/readBarCodeFromScanner.ts` | USB 扫码枪 TaskDefinition |
| `dev/screens/TaskTestScreen.tsx` | Task 测试页面 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `dev/screens/DevHome.tsx` | 新增 `taskTest` 菜单项和 Screen 注册 |

---

## Step 1: testTask/readBarCodeFromCamera.ts

- type: `externalCall`
- channel: `{ type: 'SDK', target: 'camera', mode: 'request-response' }`
- action: `'scanBarcode'`
- timeout: 15000ms（等待用户对准摄像头）
- rootNode 单节点，argsScript 构造 ExternalCallTaskArgs，resultScript 提取 barcode 字段写入 context

## Step 2: testTask/readBarCodeFromScanner.ts

- type: `externalOn`
- eventType: `'connector.passive'`（与 ExternalConnectorScreen Passive 面板一致，适配层原生固定广播此事件名）
- targetFilter: 可选，留空接收所有来源
- timeout: 30000ms
- rootNode 单节点，监听 passive 事件，每次收到扫码数据推送 progressData
- resultScript 从 ConnectorEvent.data 中提取 barcode 字段写入 context
- testContext 中可预设 targetFilter 用于过滤特定扫码枪

## Step 3: testTask/index.ts

```ts
export const TEST_TASK_DEFINITIONS = [
  readBarCodeFromCamera,
  readBarCodeFromScanner,
]
```

## Step 4: screens/TaskTestScreen.tsx

### UI 布局（三区域）

```
┌──────────────────────────────────────────────────┐
│ HEADER: Task Test                                │
├──────────────────────────────────────────────────┤
│ SELECTOR: 下拉选择 TaskDefinition                │
│ DETAIL:   展示 key/name/timeout/rootNode 结构    │
│ CONTROLS: 执行模式切换(单次/循环) + RUN/STOP 按钮 │
├──────────────────────────────────────────────────┤
│ PROGRESS STREAM (ScrollView, 自动滚到底)         │
│  每条 ProgressData 一行，最新条目高亮背景         │
│  type 用颜色编码：                               │
│    TASK_INIT/TASK_COMPLETE → accent(绿)          │
│    NODE_START/NODE_PROGRESS/NODE_COMPLETE → info(蓝) │
│    NODE_ERROR → danger(红)                       │
│    NODE_SKIP/NODE_RETRY/COMPENSATION → warn(橙)  │
│    TASK_CANCEL → textMuted(灰)                   │
│  [清空] 按钮                                     │
└──────────────────────────────────────────────────┘
```

### 状态管理

```ts
const [selectedKey, setSelectedKey]   // 当前选中的 TaskDefinition key
const [loopMode, setLoopMode]         // 单次 | 循环
const [running, setRunning]           // 是否执行中
const [progressList, setProgressList] // ProgressData[]
const sessionRef                      // 当前 TaskSession 的 cancel 句柄
```

### 执行逻辑

1. 点击 RUN：
   - 从 TEST_TASK_DEFINITIONS 找到对应 def
   - 调用 `TaskSystem.getInstance().registerTask(def)`
   - 调用 `TaskSystem.getInstance().task(key).run(requestId, def.testContext ?? {}, loopMode)`
   - 订阅 progress$，每条 push 到 progressList
   - 流 complete 时 setRunning(false)

2. 点击 STOP：
   - 调用 cancel 句柄
   - setRunning(false)

## Step 5: DevHome.tsx 修改

新增菜单项：
```ts
{key: 'taskTest', label: 'TaskTest', tag: 'TT'}
```

---

## 注意事项

1. `readBarCodeFromScanner` 的 channel target 设为空字符串，由 externalConnector 的 `getAvailableTargets` 动态发现，testContext 中可预设 target
2. TaskDefinition 的 `testContext` 字段用于测试页面传入初始 context，两个扫码 def 都需要定义
3. progressData 列表最多保留 100 条，避免内存问题
4. 组件卸载时必须 cancel 正在运行的 session，防止内存泄漏
