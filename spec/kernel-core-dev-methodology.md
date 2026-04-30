# Kernel Core 开发与调试方法论

## 目的

本文沉淀本次 `tcp-client` / `tdp-client` 开发调试过程中已经验证有效的方法，用于后续其他 `core` 包复用。重点不是某个具体业务，而是下面三类可复用能力：

1. 状态如何分层，哪些应该持久化，哪些只保留运行时。
2. `dev` 目录如何做“真实重启”验证，而不是只做一次进程内 mock。
3. 联调失败时如何同时检查客户端与服务端，避免单边误判。

## 适用范围

适用于满足下面任一条件的 `1-kernel/1.1-base/*` 包：

1. 需要通过 `communication` / HTTP / WebSocket 与服务端通信。
2. 需要在本地维护客户端状态并支持重启恢复。
3. 需要在 `dev/index.ts` 中完成可执行的端到端闭环验证。

## 前置公共能力巡检

新增任何功能、包或跨层逻辑前，必须先完成公共能力巡检。这是硬性入口，不是建议项。

1. 先读同层与下层已有包：`1-kernel/1.1-base`、同目录相邻业务包、相关 `2-ui`/`3-adapter`/`4-assembly` 组合点，以及 `0-mock-server` 中对应服务端实现。
2. 搜索已有能力和使用范式，包括 command/actor、selector、slice、transport endpoint/service、state persistence、TDP topic、error/parameter definition、server config、测试 harness、dev 验证脚本。
3. 新增 HTTP、WebSocket、状态、持久化、日志、错误、参数、ID、时间、重启恢复、mock server 对接能力时，必须优先复用基础包；只有现有框架缺少能力时，才补齐对应基础层契约。
4. 不允许因为业务包推进更快，就在业务包内私造一套与基础层平行的 fetch、storage、event bus、global manager、error string catalog、manual retry、manual URL 拼接或手写跨包状态修改。
5. 如果确实需要新抽象，先说明它不能由现有基础能力表达的原因，并放到拥有该概念的层中，而不是放到当前业务实现里。

## 一、状态设计方法

### 1. 先区分“恢复真相源”和“运行时缓存”

设计 state 时先问两个问题：

1. 机器重启后，这个字段是否必须保留，否则只能全量重建？
2. 这个字段是否只是某次连接、某次命令、某次推送的运行态观察值？

如果答案是：

1. “重启后还要靠它继续增量恢复”，它就应该进入最小持久化真相源。
2. “只是当前进程为了消费、观测、显示方便”，它就应该是 runtime-only。

### 2. 持久化只保留最小恢复集

本次 TDP 的结论是：

1. `projection` 原始推送内容不持久化。
2. `commandInbox` 不持久化。
3. `tdpSession` 不持久化。
4. `tdpControlSignals` 不持久化。
5. 只持久化 `tdpSync` 里的最小恢复字段，例如 `lastCursor`、`lastAppliedRevision`。

原因：

1. `projection` / `command` 最终会被业务层消费并转成自己的业务对象，不应该在 core 层无限囤积。
2. `command` 是时效性信号，不做“几天后继续执行”的保证。
3. 重启后真正需要的是“从哪里继续同步”，而不是“把上次运行时缓存原样复活”。

### 3. 不要把运行时观测字段混进持久化语义

典型例子：

1. `bootstrapped` 表示“本次进程完成初始化”，可以由 bootstrap 重建。
2. `lastActivationRequestId`、`lastRefreshRequestId`、`lastTaskReportRequestId` 这类字段只用于本次进程观测，不应该跨重启保留。
3. bootstrap 不应污染真正业务命令的 request id 观测字段。

这类字段一旦持久化，重启后会制造“旧状态看起来像新状态”的语义噪音。

### 4. bootstrap 只重置运行态，不清恢复游标

如果某个 slice 既有 runtime 字段，也有恢复游标，那么 bootstrap 应只清 runtime 部分。

TDP 已验证的做法是：

1. `tdpProjection`、`tdpCommandInbox`、`tdpSession` 直接 reset。
2. `tdpSync` 只 reset runtime 字段，例如 `snapshotStatus`、`changesStatus`、`lastDeliveredRevision`、`lastAckedRevision`。
3. `lastCursor`、`lastAppliedRevision` 保留，用于重启后继续增量同步。

这保证了“新进程是干净的”，同时“恢复点没有丢”。

## 二、dev 目录的验证方法

### 1. dev 不是请求脚本，而是最小可运行验证环境

`dev/index.ts` 的目标不是简单打几个请求，而是：

1. 真实加载整个 `ApplicationManager`、store、persistor、module。
2. 通过真实 command 驱动 actor、slice、repository、selector。
3. 最终按 selector 读取 state，并断言语义是否正确。

也就是说，断言对象应该优先是：

1. selector 读出来的 slice/state。
2. 落盘后的持久化内容。
3. 服务端管理接口返回的最终状态。

而不是“某个请求返回 200 就算通过”。

### 2. 必须做真实重启验证

凡是声称“支持持久化恢复”的 core 包，`dev` 都不应只在单进程里测 rehydrate。应该采用两阶段或三阶段模型：

1. `seed`：启动第一个进程，写入真实状态并 flush 持久化。
2. `verify`：启动第二个全新进程，验证状态是否从持久化恢复。
3. `full`：由父进程串起 `seed -> verify`，并检查跨阶段摘要。

关键点：

1. `seed` 和 `verify` 必须是两个独立子进程。
2. 子进程之间通过 stdout 的 JSON 摘要传递关键断言基线。
3. 不能只在同一个 Node 进程里重新创建 store，因为那不等于真实重启。

### 3. 通用“重启验证 harness”模式

后续其他 core 包可以直接复用下面模式：

1. 定义 `type DevPhase = 'full' | 'seed' | 'verify'`。
2. 父进程通过环境变量切 phase，例如 `XXX_DEV_PHASE=seed`。
3. 用 `spawn(process.execPath, [TSX_CLI, __filename], ...)` 启动子进程。
4. 子进程完成后打印单行 JSON，例如 `XXX_DEV_SEED_SUMMARY {...}`。
5. 父进程解析 stdout 中的 JSON 行，做跨重启断言。

推荐断言分层：

1. 进程内 state 是否符合预期。
2. 持久化文件里有哪些 key，被持久化的是什么，哪些不该出现。
3. 第二进程是否基于持久化结果进入正确同步路径，例如 TDP 的 `incremental`。

### 4. 本地持久化测试要接真实 storage adapter

如果要验证本地状态恢复，不能只依赖内存。应显式注册真实 `StateStorage`：

1. 在 `dev` 中调用 `registerStateStorage(...)`。
2. 使用文件型 adapter 模拟本地存储。
3. 每次 `full` 开始前显式清空该文件。

本次已经验证可复用的最小实现位于：

1. `1-kernel/test-support/storageHarness.ts`

这个 adapter 的作用：

1. 让 `redux-persist` 真正落盘。
2. 让第二个子进程可以读取第一个进程写入的状态。
3. 让测试可以直接检查持久化 key 结构。

### 5. dev 断言要覆盖“该持久化”和“不该持久化”两侧

只断言“数据恢复了”是不够的，还要断言“不该恢复的确实没恢复”。

已验证的断言模板：

1. TCP：
   1. `tcpIdentity`、`tcpCredential`、`tcpBinding` 存在于持久化。
   2. `tcpRuntime` 不应持久化。
   3. 重启后 `bootstrapped` 会重新建立，但 `lastActivationRequestId` 等 request 观测字段为空。
2. TDP：
   1. `tdpSync` 持久化。
   2. `tdpProjection`、`tdpCommandInbox`、`tdpSession` 不持久化。
   3. 第二进程重连时应读到已恢复的 `lastCursor`，并走 `incremental`。

## 三、联调方法

### 1. 不要默认问题只在客户端

如果客户端行为不对，不要一味在客户端猜。联调检查顺序建议固定为：

1. 先看服务端健康检查是否正常。
2. 再看客户端 selector/state 是否进入预期状态。
3. 再看服务端管理接口里的最终状态是否一致。
4. 如有差异，同时检查客户端实现和服务端实现。

对本仓库，涉及 `mock-terminal-platform` 时优先检查：

1. `http://127.0.0.1:5810/health`
2. 激活码、任务发布、任务实例、trace、TDP session 等 admin 接口

如果服务端行为与协议设计不符，应直接修改服务端，而不是在客户端加补丁掩盖问题。

### 2. 先建闭环，再看局部

一个 core 包如果依赖另一个 core 包，不要拆成完全孤立的假测试。

本次 TDP 的有效做法：

1. 先通过 TCP command 完成终端激活和 credential 获取。
2. 再用 TDP command 建立 WebSocket 会话。
3. 验证 projection push、command deliver、ping/pong、ack/apply、重启增量恢复的完整闭环。

也就是说：

1. TDP 的 `dev` 可以并且应该调用 TCP command。
2. 只要产品依赖关系是真实存在的，`dev` 验证就应该体现这种依赖。

### 3. 命令和投影要分开理解

本次已经验证的判断标准：

1. projection 是“需要被消费成业务对象的原始增量流”，核心关注点是游标恢复与增量同步。
2. command 是“时效性异步信号”，核心关注点是及时送达，不做长期重试执行保证。

因此：

1. projection raw 数据不需要在 core 层长期本地化。
2. command inbox 不需要持久化恢复。
3. 与 command 相关的客户端设计重点应放在接收、分发、观测，而不是离线补执行。

### 4. Android assembly / UI 自动化联调默认先走 socket 与日志

对于 `4-assembly/android/mixc-retail-assembly-rn84`、`2-ui/2.1-base/ui-automation-runtime`、双屏 UI、topology 同步、激活/注销、管理员流程这类问题，默认遵守以下顺序：

1. 先使用本地 skill `~/.codex/skills/android-assembly-socket-debug`。
2. 先使用 `scripts/android-automation-rpc.mjs` 直连 automation socket。
3. 先读真实运行态，再判断代码是否有问题。
4. 先加日志，再下结论。

涉及 `topology-runtime-v3` 主副屏同步时，优先先证明“拓扑同步通道本身是否健康”，再测业务链路。当前仓库已经内建可复用探针：

1. `kernel.base.topology-runtime-v3.demo.master`
   - 用于验证 `master-to-slave`
2. `kernel.base.topology-runtime-v3.demo.slave`
   - 用于验证 `slave-to-master`

推荐顺序：

1. 先用 `kernel.base.topology-runtime-v3.upsert-demo-master-entry`，从 `primary` 写，再从 `secondary` 读。
2. 再用 `kernel.base.topology-runtime-v3.upsert-demo-slave-entry`，从 `secondary` 写，再从 `primary` 读。
3. 再验证 `remove/reset`，确认 tombstone/清空也能同步。
4. 最后再进入真实业务链路，例如激活、注销、管理员流程。

这样能快速区分：

1. 是 topology sync 通道坏了；
2. 还是业务模块自己的 state/action/actor 有问题。

推荐最小排查顺序：

1. `session.hello` / `runtime.getInfo` 确认 `primary` / `secondary` target 是否真的 ready。
2. `runtime.selectState` / `runtime.getRequest` / `ui.getNode` 读取真实 state / request / UI。
3. 如需 isolate 问题，优先 `command.dispatch` 直接驱动单条命令，而不是一上来就跑完整激活链路。
4. 只有 direct RPC 已经证明路径稳定后，再写或跑高层自动化脚本。

日志与证据要求：

1. 调试问题时，TS 侧和原生侧都可以并且应该加 targeted logs。
2. 先 `adb logcat -c`，单次复现，再用 `adb logcat -d -v epoch` 或 `-v time` 对齐时序。
3. 不要主要靠读代码和猜。代码阅读只用于缩小嫌疑范围，不是主要证据来源。

双屏时序判断要求：

1. 副屏延迟约 `3s` 启动是业务需要，不应把它和“主副屏同步慢”混为一谈。
2. 冷启动 ready 时间与 ready 后同步延迟必须分开测。
3. 当前仓库已经验证：主副屏都 ready 后，主屏 state 变更传播到副屏 state / UI 大约在 `~100ms` 量级。

异常处理要求：

1. 如果副屏按预期本该起来却没起来，应先按 crash / hang 排查。
2. 不要用“手动再拉起副屏”来掩盖启动问题，然后继续测业务链路。

## 四、推荐实施清单

后续新增需要通信和恢复能力的 core 包时，建议按下面顺序推进：

1. 先定义 state：明确哪些是最小恢复真相源，哪些是 runtime-only。
2. 先写 bootstrap 语义：确认哪些字段重置，哪些字段保留。
3. 再写 selector：保证 `dev` 可以从 selector 层做断言。
4. 在 `dev` 中接入真实 storage adapter，而不是内存 mock。
5. 采用 `full / seed / verify` 三阶段重启 harness。
6. 联调时同时验证客户端 state、持久化文件、服务端 admin 接口。
7. 如果依赖上游 core 包，`dev` 里直接构建真实依赖闭环。

## 五、执行建议

### 启动服务端

如需联调 `mock-terminal-platform`，在仓库根目录运行：

```bash
corepack yarn mock:platform:dev
```

### 开发与排查时优先看的位置

1. `1-kernel/test-support/storageHarness.ts`
2. `1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness.ts`
3. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts`
4. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/terminalTopologyIntegrationHarnessV3.ts`

这三处已经形成了当前仓库里最接近“可复用模板”的实现。

## 六、后续可继续抽象的方向

当前方法论已经稳定，但代码层面还可以继续抽象一个真正通用的 `shared-dev` harness，统一提供：

1. phase 管理
2. child process 启动
3. stdout JSON 摘要解析
4. storage 文件清理与快照读取
5. 通用断言辅助

在抽象之前，仍建议先遵守本文方法，确保每个 core 包的状态边界和重启语义是清晰的，再做公共封装。
