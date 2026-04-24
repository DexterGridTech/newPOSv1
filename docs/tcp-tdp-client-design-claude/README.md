# terminal-data 设计总览

> 版本：2.0 | 状态：详细设计稿 | 日期：2026-04-06
> 目标：为 `_old_/1-kernel/1.1-cores/terminal` 提供新一代替代包设计方案
> 包名：`@next/kernel-core-terminal-data`
> 模块名：`kernel.core.terminal-data`

---

## 文档目录

| 文档 | 内容摘要 |
|------|---------|
| [00-设计背景与目标](./00-设计背景与目标.md) | 为什么需要新包、设计原则、与旧包的核心差异 |
| [01-架构与边界设计](./01-架构与边界设计.md) | 分层架构、TCP/TDP 边界、模块依赖关系 |
| [02-领域模型与状态设计](./02-领域模型与状态设计.md) | 所有实体类型定义、8 个 Redux slices 设计 |
| [03-模块结构与接口设计](./03-模块结构与接口设计.md) | 完整目录结构、Commands、Actors、Hooks |
| [04-关键流程设计](./04-关键流程设计.md) | 初始化、激活、同步、任务投递、配置、热更新 |
| [05-兼容策略与迁移建议](./05-兼容策略与迁移建议.md) | 与旧包的关系、迁移阶段、风险控制 |

---

## 一句话定义

`terminal-data` 是一个**面向终端侧的 TCP/TDP 客户端通用数据内核**。

它负责：
- **终端身份与激活**：设备注册、激活码校验、凭证管理
- **TCP 控制平面**：Bootstrap 同步、任务结果上报、状态上报
- **TDP 数据平面**：WebSocket 会话管理、Projection 同步、Change 追赶
- **本地运行时状态**：期望配置、期望版本、任务收件箱
- **组织绑定上下文**：tenant / brand / store / profile 显式引用
- **派生树视图**：客户端组织树，辅助 UI 展示和 Scope 理解

它**不再以旧 `unitData + Unit 树 + kernelWS` 作为核心模型**。

---

## 与旧 `terminal` 包的根本差异

### 旧 `terminal` 包（已有）

```
旧 terminal 包的设计中心：
┌──────────────────────────────────────────┐
│  kernel WS 连接（混合控制+数据通道）       │
│  unitData 同步（group + unit path 体系）   │
│  operatingEntity / model / terminal 树    │
│  rootPath 覆盖优先级机制                  │
│  device token 注入                        │
└──────────────────────────────────────────┘
```

**问题**：
1. 控制面和数据面没有明确分离
2. `unitData` 的树状覆盖模型与新 TDP 设计不兼容
3. 状态散落，没有统一的 Redux 管理
4. 与业务模块耦合，难以复用

### 新 `terminal-data` 包（本设计）

```
新 terminal-data 包的设计中心：
┌──────────────────────────────────────────┐
│  TCP 控制平面（HTTP API，显式实体引用）    │
│  TDP 数据平面（WebSocket，Topic/Scope）   │
│  Projection / ChangeLog 体系             │
│  显式身份与绑定上下文                    │
│  Redux slices 统一状态管理               │
│  派生树（仅视图，非权威）                 │
└──────────────────────────────────────────┘
```

**优势**：
1. TCP/TDP 职责清晰分离
2. 显式实体引用，无隐式覆盖
3. 统一 Redux 状态管理，可预测
4. 纯数据内核，业务解耦，易复用

---

## 核心能力全景

### 1. 终端身份与凭证

```
TerminalIdentity          TerminalCredential
  ├─ terminalId             ├─ accessToken
  ├─ deviceId               ├─ refreshToken
  ├─ deviceFingerprint      ├─ expiresAt
  ├─ activationStatus       └─ tokenType
  └─ activatedAt
```

### 2. 绑定上下文

```
TerminalBindingContext
  ├─ terminalId
  ├─ tenant: TenantRef { tenantId, name, code }
  ├─ brand: BrandRef { brandId, name, code }
  ├─ store: StoreRef { storeId, name, code }
  └─ profile: TerminalProfileRef { profileId, name, code }
```

### 3. TCP 控制平面

```
TcpControlClient
  ├─ activate(activationCode)
  ├─ refreshCredential(refreshToken)
  ├─ fetchBootstrap(terminalId)
  └─ reportTaskResult(terminalId, report)
```

### 4. TDP 数据平面

```
TdpSessionClient               TdpSyncClient
  ├─ connect(params)             ├─ fetchSnapshot(params)
  ├─ disconnect()                └─ fetchChanges(params)
  ├─ sendHeartbeat()
  ├─ onMessage(handler)
  └─ onError(handler)
```

### 5. Redux State 架构

```
Redux Store
  ├─ terminalIdentity      身份与凭证状态
  ├─ terminalBinding       绑定上下文状态
  ├─ terminalRuntime       运行时状态（配置/版本/inbox）
  ├─ tcpClient             TCP 客户端状态
  ├─ tdpSession            TDP 会话状态
  ├─ tdpProjection         Projection 数据状态
  ├─ tdpInbox              任务收件箱状态
  └─ terminalDerivedTree   派生树视图状态
```

---

## 快速上手

### 1. 在整合层注册模块

```typescript
// 4-assembly/your-app/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import { terminalDataModule } from '@next/kernel-core-terminal-data'

export const store = configureStore({
  reducer: {
    // ... 其他 reducers
    ...terminalDataModule.getReducers(),
  },
})
```

### 2. 注入 Adapters

```typescript
// 4-assembly/your-app/src/setup.ts
import { terminalDataModulePreSetup } from '@next/kernel-core-terminal-data'
import { RNDeviceInfoAdapter } from '@next/adapter-android-rn84'
import { MMKVStorageAdapter } from './adapters/MMKVStorageAdapter'
import { axiosTransportAdapter } from './adapters/AxiosTransportAdapter'
import { wsTransportAdapter } from './adapters/WebSocketTransportAdapter'

await terminalDataModulePreSetup({
  dispatch: store.dispatch,
  getState: store.getState,
  adapters: {
    deviceInfo: new RNDeviceInfoAdapter(),
    storage: new MMKVStorageAdapter(),
    tcpTransport: axiosTransportAdapter,
    tdpTransport: wsTransportAdapter,
    logger: console,
    clock: { now: () => Date.now() },
  },
})
```

### 3. 初始化模块

```typescript
// 4-assembly/your-app/src/App.tsx
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { bootstrapTerminalData } from '@next/kernel-core-terminal-data'

function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    bootstrapTerminalData(dispatch, store.getState)
      .catch(console.error)
  }, [dispatch])

  return <MainScreen />
}
```

### 4. 在 UI 中使用 Hooks

```typescript
// 2-ui/your-ui/src/screens/HomeScreen.tsx
import {
  useTerminalIdentity,
  useTdpSessionStatus,
  useProjection,
  useDesiredConfig,
} from '@next/kernel-core-terminal-data'

function HomeScreen() {
  const { identity, isActivated } = useTerminalIdentity()
  const { status: sessionStatus } = useTdpSessionStatus()
  const storeProjection = useProjection('store.info')
  const desiredConfig = useDesiredConfig()

  if (!isActivated) {
    return <ActivationScreen />
  }

  return (
    <View>
      <Text>Terminal: {identity?.terminalId}</Text>
      <Text>Session: {sessionStatus}</Text>
      {/* ... */}
    </View>
  )
}
```

### 5. 消费任务投递

```typescript
// 上层业务模块
import {
  selectUnconsumedInboxItems,
  terminalDataCommands,
} from '@next/kernel-core-terminal-data'

function TaskHandler() {
  const dispatch = useDispatch()
  const inboxItems = useSelector(selectUnconsumedInboxItems)

  useEffect(() => {
    for (const item of inboxItems) {
      handleTask(item)
        .then(() => {
          dispatch(terminalDataCommands.reportTaskResult({
            releaseId: item.payload.releaseId,
            result: 'SUCCESS',
          }))
          dispatch(terminalDataCommands.markDeliveryConsumed({
            envelopeId: item.envelopeId,
          }))
        })
        .catch(console.error)
    }
  }, [inboxItems, dispatch])

  return null
}
```

---

## 设计原则摘要

| 原则 | 描述 |
|------|------|
| **显式实体优先** | `tenant/brand/store/profile/terminal` 为显式引用实体，不使用树路径隐式推导 |
| **控制面与数据面解耦** | TCP（控制）和 TDP（数据）在客户端中分别建模与同步 |
| **强状态可观察** | 每类状态都有明确的 slice、selector、actor 与 command |
| **派生树仅为视图** | 客户端派生树不是权威模型，不参与 Scope 权威判断 |
| **框架风格继承** | 保持 `AppModule + slices + commands + actors + supports + foundations` 结构 |
| **适配层注入** | 设备、存储、网络、连接、时钟、日志全部通过 adapter 抽象接入 |
| **最小依赖** | 不依赖业务域包，保持通用数据内核的纯粹性 |

---

## 保留与不保留

### ✅ 保留在新内核中的能力

- 终端身份、激活、凭证管理
- 终端绑定上下文（tenant/brand/store/profile）
- TDP Session / heartbeat / reconnect / catch-up
- Projection 缓存与变更消费
- 任务投递接收与结果上报
- 本地配置目标、版本目标
- 派生树视图能力（客户端视图，非权威）

### ❌ 不保留为核心模型的能力

- 旧 `unitData` 体系（group + unit path 覆盖）
- 旧 `Unit` 万能树模型（operatingEntity/model/terminal 树）
- 旧 `rootPath` 覆盖优先级机制
- 旧 `kernelWS` 专属协议语义
- 项目特定业务域解释逻辑（配置应用、版本安装等）

---

## 相关文档

- [Mock TCP/TDP 服务器设计](../mock-design-claude/README.md)
- [TCP 控制平面服务设计](../real-tcp-design-claude/README.md)
- [原始设计草稿](../tcp-tdp-client-design/README.md)（粗稿参考）
