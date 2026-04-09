# 核心基础架构时间与运行时 ID 设计约束

## 1. 文档目标

本文档用于定义新基础架构中：

- 时间字段如何存储
- 时间如何格式化展示
- 运行时 ID 如何统一生成
- 统一 ID 方案的作用域边界

本文档覆盖：

- `1-kernel/1.1-base/*`
- `1-kernel/*`
- `2-ui/*`
- `3-adapter/*`
- `4-assembly/*`

本文档不要求：

- `0-mock-server/*` 复用同一套 ID 生成实现
- 服务端或 mock 宿主与产品 runtime 共享同一个 ID helper

也就是说：

1. 新基础架构要统一产品运行时四层的时间语义与 ID 语义。
2. `0-mock-server` 只需要协议兼容，不需要接入同一套统一 ID 生成器。

---

## 2. 对旧工程的判断

旧工程在这两个点上其实已经给出了明确方向：

1. `updatedAt / createdAt / occurredAt` 大量场景已经使用毫秒时间戳数字。
2. `requestId / commandId / sessionId / nodeId` 已经是跨 command、task、UI、adapter、assembly 的统一上下文字段。
3. `shortId()`、`createId(prefix)` 等 helper 虽然分散，但已经说明系统需要统一的运行时 ID 语言。
4. `time.ts` 已经说明“格式化展示时间”应该由专门 helper 承担，而不是把格式化字符串当作存储真相。

旧设计的问题不是方向错了，而是：

1. 时间字段缺少显式硬约束，仍有被字符串化存储的风险。
2. ID 生成分散在多个 helper 中，没有统一命名和统一调用入口。
3. 产品 runtime 与 mock/server 宿主的边界没有被清楚写出来。

一句话结论：

新架构应该把旧工程里已经事实成立的时间与 ID 习惯，升级成显式 contract。

---

## 3. 总体结论

新架构中必须遵守下面四条总规则：

1. 所有运行时存储中的时间相关字段，一律使用 `long` 语义的毫秒时间戳数字。
2. 格式化时间字符串只能用于展示、控制台渲染、日志渲染，不能反向成为存储真相。
3. 产品 runtime 四层必须使用统一的运行时 ID 生成入口。
4. `0-mock-server` 及其他服务端实现只要求协议兼容，不要求复用产品 runtime 的统一 ID 生成器。

---

## 4. 时间语义

## 4.1 基本规则

后续新架构中的时间相关字段统一使用：

```ts
type TimestampMs = number
```

这里的 `number` 在 TypeScript 里表达的是：

1. 毫秒级 Unix 时间戳
2. `Date.now()` 同语义
3. `long` 语义

也就是说：

1. 可以是 `createdAt`
2. 可以是 `updatedAt`
3. 可以是 `startedAt`
4. 可以是 `completedAt`
5. 可以是 `occurredAt`
6. 可以是 `expiresAt`
7. 可以是 `issuedAt`
8. 可以是 `hostTime`

但它们都必须是毫秒时间戳数字。

## 4.2 禁止项

下面这些不能成为运行时存储真相：

1. ISO 时间字符串
2. 本地格式化时间字符串
3. `Date` 对象直接进 state / protocol / persistence
4. 混合秒级与毫秒级的裸数字字段

换句话说：

1. state 里不存 `"2026-04-09T10:00:00.000Z"`
2. protocol 里不存 `"2026-4-9 10:00:00 123"`
3. persistence 里不存 `new Date()`

都只存 `TimestampMs`。

## 4.3 哪些地方必须用 `TimestampMs`

至少包括：

1. request lifecycle 字段
2. command lifecycle 字段
3. session / pairing / heartbeat 字段
4. projection / catalog / parameter / error 覆盖目录字段
5. workspace 顶层字段同步中的 `updatedAt`
6. `LogEvent.timestamp`
7. runtime 内部 journal / ledger / observation 字段

## 4.4 时间格式化规则

格式化时间字符串只在下面场景使用：

1. UI 展示
2. 控制台输出
3. 文件日志渲染
4. 调试信息拼装

格式化能力应提供统一 helper，方向参考旧：

- [time.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/base/src/foundations/time.ts)

但新架构必须明确：

1. `LogEvent` 存储原始 `timestamp`
2. 宿主渲染日志时再调用格式化 helper
3. UI 要展示时间时再调用格式化 helper
4. 格式化结果不回写 state / catalog / protocol

## 4.5 建议的统一能力

建议在新基础架构最低层提供：

1. `nowTimestampMs(): TimestampMs`
2. `formatTimestampMs(timestamp: TimestampMs): string`

其中：

1. `nowTimestampMs()` 用于统一取当前时间
2. `formatTimestampMs(...)` 用于统一渲染时间文本

---

## 5. 运行时 ID 语义

## 5.1 基本规则

新架构中的运行时 ID 必须继续保留显式语义类型，例如：

1. `RequestId`
2. `CommandId`
3. `SessionId`
4. `NodeId`
5. `EnvelopeId`
6. `DispatchId`
7. `ProjectionId`

它们在协议层本质上仍是字符串，但在架构语言上不再是“随便一个 string”。

## 5.2 为什么必须统一

旧工程里这些 ID 已经承担了真实系统职责：

1. command 链路关联
2. task 与 command 关联
3. UI request 状态观测
4. topology session 关联
5. adapter / assembly / logger 上下文追踪

因此统一的不是“字符串算法本身”，而是：

1. 类型语义
2. 命名语义
3. 调用入口
4. 上下文字段位置

## 5.3 统一范围

统一运行时 ID 生成器的作用域只限于：

1. `1-kernel`
2. `2-ui`
3. `3-adapter`
4. `4-assembly`

不外溢到：

1. `0-mock-server`
2. 后端服务
3. 独立联调工具

这些外部系统只需要：

1. 协议字段兼容
2. 字符串可传递
3. 必要时可自定义自己的 ID 生成策略

## 5.4 对 `0-mock-server` 的要求

`0-mock-server` 不需要导入产品 runtime 的统一 ID helper。

它只需要做到：

1. 能接收并透传产品 runtime 生成的 ID
2. 自己生成 ID 时不破坏协议字段语义
3. 如需生成 mock 侧自己的 event / dispatch / projection id，可使用独立实现

也就是说：

1. 协议统一
2. 实现独立

## 5.5 建议的统一能力

建议在新基础架构最低层提供：

1. `createRuntimeId(kind)`
2. `createRequestId()`
3. `createCommandId()`
4. `createSessionId()`
5. `createNodeId()`

其中 `kind` 应是显式受控枚举，而不是任意字符串。

建议方向：

1. 允许带可读前缀
2. 保证在产品 runtime 内具备足够低碰撞概率
3. 业务代码不再直接调用旧 `shortId()`

---

## 6. 包落点建议

## 6.1 `contracts`

`contracts` 应承担：

1. `TimestampMs` 类型语义
2. `RequestId / CommandId / SessionId / NodeId` 等 ID 类型语义
3. `nowTimestampMs()`
4. `formatTimestampMs(...)`
5. `createRuntimeId(...)` 及各语义化 helper

原因：

1. 这几项都属于最底层公共语言
2. 不依赖宿主平台能力
3. `2-ui / 3-adapter / 4-assembly` 也需要直接复用

## 6.2 `platform-ports`

`platform-ports` 不负责定义时间真相和 ID 真相，但要遵守：

1. `LogEvent.timestamp` 使用 `TimestampMs`
2. logger 渲染层可使用 `formatTimestampMs(...)`
3. port 上下文字段必须使用显式 ID 语义字段，而不是把 ID 塞进 message

## 6.3 `topology-runtime` 与 `dual-topology-host`

`topology-runtime` 应复用产品 runtime 的统一时间与 ID helper。

`dual-topology-host` 不要求复用同一实现，但必须遵守：

1. 协议里的时间字段使用毫秒时间戳数字
2. 协议里的 ID 字段保持语义稳定
3. 不把 host 的独立实现反向变成产品 runtime 的约束

---

## 7. 对后续实现的直接要求

后续实现必须满足：

1. 新包中的所有时间相关存储字段都以 `TimestampMs` 表达。
2. 展示和日志渲染只能通过统一格式化 helper 处理时间。
3. 新代码不再直接新增旧 `shortId()` 风格散装调用点。
4. `1-kernel / 2-ui / 3-adapter / 4-assembly` 统一走同一套 runtime ID helper。
5. `0-mock-server` 不接入这套统一 ID helper，只做协议兼容。

---

## 8. 一句话结论

新架构里：

1. 时间真相一律是毫秒时间戳数字。
2. 格式化时间只用于展示和日志渲染。
3. 运行时 ID 在产品四层统一生成。
4. `0-mock-server` 只做协议兼容，不共享同一套 ID 生成实现。
