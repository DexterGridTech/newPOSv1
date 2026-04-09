# 核心基础架构 Logger 设计约束

## 1. 文档目标

本文档用于定义新基础架构中 logger 的统一约束，覆盖：

- `1-kernel/1.1-base/platform-ports`
- `1-kernel/1.1-base/execution-runtime`
- `1-kernel/1.1-base/transport-runtime`
- `1-kernel/1.1-base/topology-runtime`
- `1-kernel/1.1-base/runtime-shell`
- 各宿主 adapter / assembly 的日志落盘与上传实现

本文档的目标不是先实现日志上传，而是先把日志模型、脱敏规则、helper 设计、宿主责任边界定义清楚。

---

## 2. 现状判断

旧工程的 logger 方向是对的，但接口层级还不够。

已经做对的部分：

1. kernel 不直接依赖宿主日志实现。
2. 多宿主共享同一套 `debug / log / warn / error` 调用入口。
3. Android / Electron 已经具备本地日志落盘与读取能力。
4. `moduleName + LOG_TAGS + componentName` 这套命名方式有稳定工程价值。

当前不足：

1. 日志真相仍是“文本 + 任意 data”，不是稳定事件模型。
2. `requestId / commandId / sessionId / nodeId` 等关键上下文没有固定字段位置。
3. Android 当前会把 `message + data` 直接拼成文本，后续上传难以做结构化检索。
4. helper 不足，业务代码经常手工拼 tags、message、payload。
5. 没有统一脱敏策略，后续很难兼顾排障和后台统一管理。

因此新架构要保留旧接口方向，但必须升级为：

1. 结构化日志事件模型。
2. runtime 自动补上下文。
3. 更重的 helper。
4. 明确的 `DEV / PROD` 脱敏策略。

---

## 3. 总体结论

新架构里的 logger 必须遵守下面总原则：

1. 记录的真相必须是结构化 `LogEvent`，不是 console 文本。
2. console 文本、文件落盘、后台上传都应由同一个 `LogEvent` 派生。
3. `DEV` 环境允许记录敏感原文。
4. `PROD` 环境必须统一脱敏，不允许原文进入本地文件或上传日志。
5. 业务代码不应频繁直接拼装完整日志对象，必须通过 helper 降低样板代码。

---

## 4. 日志事件模型

## 4.1 基本对象

新架构应统一使用 `LogEvent` 作为日志真相对象。

建议最小结构：

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEvent {
  timestamp: number
  level: LogLevel
  category: string
  event: string
  message?: string

  scope: {
    moduleName: string
    layer?: 'kernel' | 'ui' | 'adapter' | 'assembly' | 'mock-server'
    subsystem?: string
    component?: string
  }

  context?: {
    requestId?: string
    commandId?: string
    commandName?: string
    sessionId?: string
    topologySessionId?: string
    nodeId?: string
    peerNodeId?: string
    traceId?: string
  }

  data?: Record<string, unknown>
  error?: {
    name?: string
    code?: string
    message: string
    stack?: string
  }

  security: {
    containsSensitiveRaw: boolean
    maskingMode: 'raw' | 'masked'
  }
}
```

## 4.2 为什么必须结构化

原因：

1. 后台统一日志管理不能依赖解析自由文本。
2. request / command / topology 链路需要稳定上下文字段，不能埋在 message 里。
3. 同一条事件要同时支持 console、文件、上传三种消费方式。

---

## 5. 分类与上下文约束

## 5.1 category 必须有限且稳定

第一版建议固定在下面这些主类中：

1. `runtime.lifecycle`
2. `command.lifecycle`
3. `request.lifecycle`
4. `transport.http`
5. `transport.ws`
6. `topology.session`
7. `topology.routing`
8. `projection.sync`
9. `storage.persistence`
10. `ui.lifecycle`
11. `host.adapter`

业务可以扩展子事件，但不应无限扩展顶层 category。

## 5.2 必须固定的上下文字段

后续所有 runtime helper 至少要支持自动补齐下面字段：

1. `moduleName`
2. `requestId`
3. `commandId`
4. `commandName`
5. `sessionId`
6. `nodeId`
7. `peerNodeId`

原则：

1. 能拿到就写到固定字段。
2. 拿不到就省略。
3. 禁止把这些关键字段只写在 message 文本里。

---

## 6. `DEV / PROD` 脱敏规则

## 6.1 环境规则

敏感原文策略明确为：

1. `DEV` 环境允许记录敏感原文。
2. `PROD` 环境必须统一脱敏。

这里的“必须统一脱敏”同时覆盖：

1. console 输出
2. 本地文件落盘
3. 后台上传

也就是说：

1. `DEV` 可以 raw。
2. `PROD` 只能 masked。

## 6.2 为什么不做运行时手动开关

本次结论不再采用“运行时显式开关是否记录原文”的方案，而采用环境级规则：

1. 开发环境排障时允许原文，降低调试成本。
2. 生产环境统一脱敏，避免日志系统沦为敏感数据仓库。
3. 规则简单，减少误配置风险。

## 6.3 需要脱敏的对象

至少包括：

1. token
2. password
3. credential
4. 手机号
5. 身份标识号
6. 支付敏感字段
7. 服务端下发的完整敏感业务 payload

`PROD` 中应转成：

1. 摘要
2. 哈希
3. 部分掩码
4. 长度与类型信息

而不是原文。

---

## 7. helper 设计要求

## 7.1 总目标

业务侧应该尽量少写下面这些重复内容：

1. category
2. event
3. moduleName
4. subsystem
5. requestId / commandId / sessionId
6. 脱敏处理

因此 helper 要做重，不要把“结构化日志对象组装工作”重新甩给业务。

## 7.2 helper 分层

建议分三层：

### 第一层：基础 logger

提供：

```ts
logger.debug(event)
logger.info(event)
logger.warn(event)
logger.error(event)
```

这一层只负责接收结构化对象。

### 第二层：scope logger

由 runtime 或模块创建：

```ts
const scopedLogger = createScopedLogger({
  moduleName,
  layer: 'kernel',
  subsystem: 'execution-runtime',
  component: 'CommandExecutor',
})
```

它负责自动补 scope。

### 第三层：场景 helper

必须提供大量现成 helper，减少业务手写日志对象。

第一版建议至少有：

1. `commandAccepted(...)`
2. `commandStarted(...)`
3. `commandCompleted(...)`
4. `commandFailed(...)`
5. `requestProjectionUpdated(...)`
6. `httpRequestStarted(...)`
7. `httpRequestCompleted(...)`
8. `httpRequestFailed(...)`
9. `wsConnected(...)`
10. `wsDisconnected(...)`
11. `topologySessionOpened(...)`
12. `topologySessionClosed(...)`
13. `statePersisted(...)`
14. `stateRehydrated(...)`

这些 helper 内部完成：

1. category / event 固定。
2. scope 自动补齐。
3. 常见 context 自动补齐。
4. `DEV / PROD` 脱敏策略自动执行。

## 7.3 业务代码应该写成什么样

目标不是这样：

```ts
logger.info({
  category: 'command.lifecycle',
  event: 'command.started',
  ...
})
```

而是更接近：

```ts
commandLogger.started(command, {
  payload: payloadSummary,
})
```

或者：

```ts
transportLogger.httpFailed(requestContext, error, {
  endpoint: '/terminal/activate',
})
```

也就是说：

1. 业务描述事实。
2. helper 负责组日志对象。

---

## 8. `platform-ports` 与宿主职责边界

## 8.1 `platform-ports` 要定义什么

`platform-ports` 中应定义：

1. `LogEvent`
2. `LogLevel`
3. `LoggerPort`
4. `LogMasker`
5. `createScopedLogger(...)` 所需类型

## 8.2 `LoggerPort` 的职责

`LoggerPort` 只负责“接收结构化日志事件并写入宿主日志通道”。

它不负责：

1. 决定业务是否应该打这条日志。
2. 让 kernel 了解上传协议。
3. 让业务关心落盘路径。

## 8.3 上传责任不进入 kernel

后续日志上传虽然存在，但不应让 kernel 直接依赖“上传日志服务”。

建议职责划分：

1. kernel / ui / runtime 只产生 `LogEvent`
2. adapter / assembly 负责落盘
3. adapter / assembly 或宿主后台线程负责上传、轮转、重试、清理

这样 kernel 继续只依赖 `LoggerPort`，不会被上传策略反向污染。

---

## 9. 运行时自动补充能力

新架构里 runtime 应帮助业务自动补上下文，而不是要求每条日志都手写。

至少应支持：

1. `execution-runtime` 自动补 `requestId / commandId / commandName`
2. `transport-runtime` 自动补 `sessionId / endpoint / connectionId`
3. `topology-runtime` 自动补 `nodeId / peerNodeId / topologySessionId`
4. `runtime-shell` 自动补 layer / environment / runtime instance 信息

这件事非常重要，因为：

1. 上下文统一比 message 好看更重要。
2. 后台统一管理能否可用，核心就在上下文是否稳定。

---

## 10. 打日志的工程纪律

后续基础包与业务包需要遵守下面纪律：

1. 不要把 request / command / node 等关键上下文只写在字符串里。
2. 不要在 `PROD` 中记录敏感原文。
3. 不要把完整大 payload 无差别塞进 `data`。
4. `error` 必须进入专门字段，不要只写 `message: error.message`。
5. `debug` 可以多，但必须可过滤，不应污染 `info / warn / error`。
6. reducer/slice 内日志应极少，仅保留关键不变量错误，不应成为主要观测入口。
7. command / transport / topology / persistence 这些运行时节点，应优先使用场景 helper 打日志。

---

## 11. 对后续实现的直接要求

基于本文约束，后续 logger 实施必须满足：

1. 新 `LoggerPort` 以结构化事件为输入，不再以“纯 tags + message + data”作为最终模型。
2. `DEV` 与 `PROD` 的脱敏规则必须在宿主侧和 helper 层都可验证。
3. helper 必须足够多，业务不应频繁手写完整日志对象。
4. 本地落盘格式应优先考虑 JSON Lines 或等价结构化格式。
5. 后续上传若接入后台日志系统，不应再做二次字符串解析。

---

## 12. 一句话结论

新架构里的 logger 不应该只是“统一 console 封装”，而应该是：

1. 结构化事件模型。
2. `DEV raw / PROD masked` 的明确策略。
3. runtime 自动补上下文。
4. helper 主导、业务轻写。
5. 宿主负责落盘与上传，kernel 只负责产生日志事件。
