# 1-kernel/1.1-base

`1-kernel/1.1-base` 是新版 kernel 基础层。

它承接旧 `1-kernel/1.1-cores/base`、`interconnection`、`communication`、`task`、`navigation`、`terminal` 中真正有价值的业务能力，但不做旧包的一比一复刻。新基础层的目标是把旧工程里职责过重、边界不清、全局状态过多的能力重新拆成一组职责明确、依赖清晰、协议公开、可测试、可扩展的基础包。

旧 `1-kernel/1.1-cores` 以后只作为设计参考和回归语义参考，不再作为新业务包的依赖来源。未来 `1-kernel/1.2-business`、`2-ui`、`3-adapter`、`4-assembly` 应优先围绕本目录的基础协议和 runtime 能力继续建设。

## 一、总设计目标

新版 base 层重点继承旧工程的这些优点：

1. `moduleName` 是包级命名空间真相源，用于 command、actor、slice、日志 scope、error key、parameter key。
2. `Command` 是跨包写操作的正式入口，`Actor` 是 command 的执行者。
3. Redux 继续作为 kernel 核心状态真相源，业务状态、持久化状态和可同步状态都要有统一建模。
4. 主副机、多屏、workspace、instance/display 等 POS 真实业务上下文继续是基础语义。
5. HTTP、WS、TDP、TCP、双机拓扑、UI runtime、workflow 都必须支持真实联调和重启恢复验证。
6. errorMessages 和 systemParameters 继续是基础能力，并支持静态定义与远端动态覆盖。
7. 初始化过程必须清晰，模块依赖、预处理、安装、启动日志都应该可读、可观测。

新版 base 层刻意修正旧工程的这些问题：

1. 不再让一个 `ApplicationManager` 或一个包承载过多职责。
2. 不再把 transport 成功和业务完成语义混在一起。
3. 不再让业务包各自实现 HTTP/WS/TDP/持久化/同步。
4. 不再让 kernel 包依赖 React、Android、Electron、Node、Web 等具体平台能力。
5. 不再把远端 projection、error catalog、parameter catalog、workflow definitions 的动态更新散落在业务逻辑里。
6. 不再让包根 `index.ts` 暴露过宽的内部实现面。

## 二、硬性架构规则

这些规则是后续维护和新增业务包时必须优先遵守的约束。

1. `1-kernel/1.1-base` 是新的 canonical kernel base；旧 `1-kernel/1.1-cores` 只作参考。
2. kernel 包不能依赖 React。`hooks/index.ts` 可以保留规则说明或空出口，但真实 hook 实现应在 `2-ui` 或 assembly。
3. 每个包都应保留 `moduleName`，并用它派生命名空间、日志 scope、command key、actor key、slice key。
4. `runtime-shell-v2` 是唯一 runtime shell，不允许重新引入多个并列 global manager。
5. `state-runtime` 是统一 Redux、持久化、同步基座，业务包不能自建 redux-persist 或私有 storage 副本。
6. 跨包写操作走 public command；跨包读操作走 selector；slice action 默认只在包内使用。
7. 全局 state 可读，但不能因此绕过 command 直接改其他包 state。
8. `transport-runtime` 只做 transport 语义，不解析业务成功、业务失败、业务结果。
9. `tdp-sync-runtime-v2` 只维护 TDP projection 仓库和通用 topic 变化广播，不耦合普通业务模块。
10. `topology-runtime-v2` 只维护双机活控制面和必要恢复信息，不承载业务状态仓库。
11. `workflow-runtime-v2` 的统一真相是 `WorkflowObservation`，不是一次性 result。
12. 所有时间存储统一用 long 毫秒时间戳，展示和日志再格式化。
13. 所有运行时 ID、request ID、command ID、envelope ID 必须使用统一 ID 生成能力。
14. error definitions 和 parameter definitions 要放到 `supports/errors.ts`、`supports/parameters.ts`，业务逻辑只引用定义对象，不散落魔法字符串。
15. `test` 是标准测试目录名，不再使用 `dev` 作为测试目录。

## 三、依赖分层

基础层按职责分为几层。

```text
contracts
platform-ports
definition-registry
execution-runtime
state-runtime
runtime-shell-v2
transport-runtime
host-runtime
tcp-control-runtime-v2
tdp-sync-runtime-v2
topology-runtime-v2
ui-runtime-v2
workflow-runtime-v2
```

推荐理解方式如下：

| 层级 | 包 | 职责 |
| --- | --- | --- |
| 协议层 | `contracts` | 跨包共享语言，包含 ID、时间、错误、参数、request、topology、state-sync 等协议。 |
| 端口层 | `platform-ports` | kernel 访问外部世界的宿主端口，例如 logger、storage、scriptExecutor。 |
| 定义解析层 | `definition-registry` | error/parameter 静态定义、动态 catalog 的解析、decode、validate、fallback。 |
| 执行原语层 | `execution-runtime` | 低层 command handler/middleware/journal/lifecycle 执行器。 |
| 状态基座层 | `state-runtime` | Redux store、hydrate、flush、field/record 级持久化、普通/加密存储。 |
| 运行时外壳层 | `runtime-shell-v2` | 模块装配、Command/Actor 广播执行、request ledger、parameter resolver、state sync 接口。 |
| 传输层 | `transport-runtime` | HTTP/WS 地址选择、失败切换、重试、有效地址保持、socket lifecycle。 |
| Host 控制面 | `host-runtime` | 双机 host 的 ticket、session、relay、resume、fault injection。 |
| TCP 控制面 | `tcp-control-runtime-v2` | 终端激活、凭证刷新、任务结果上报。 |
| TDP 数据面 | `tdp-sync-runtime-v2` | TDP session、projection 全量仓库、生效 projection 解析、topic 变化广播。 |
| 双机拓扑 | `topology-runtime-v2` | 主副机连接、remote command、request mirror、state sync、resume/reconnect。 |
| UI runtime | `ui-runtime-v2` | screen、overlay、alert、workspace、UI variable 的 kernel 状态协议。 |
| Workflow runtime | `workflow-runtime-v2` | 动态 workflow definitions、串行队列、Observable observation 运行视图。 |

## 四、统一包结构

运行时型基础包应尽量保持同一阅读结构。

```text
src/
  application/
    createModule.ts
    moduleManifest.ts
    index.ts
  features/
    commands/
    actors/
    slices/
  foundations/
  selectors/
  supports/
    errors.ts
    parameters.ts
  types/
  moduleName.ts
  index.ts
test/
  scenarios/
  helpers/
  index.ts
```

目录语义如下：

| 目录 | 语义 |
| --- | --- |
| `src/application` | 对外装配入口、模块 manifest、descriptor、preSetup、createModule。 |
| `src/features/commands` | public command definitions。 |
| `src/features/actors` | command 执行者，按职责拆文件，避免堆一个大 `index.ts`。 |
| `src/features/slices` | Redux slice 定义，action 默认包内使用。 |
| `src/foundations` | 包内部基础实现，不作为首选公开 API。 |
| `src/selectors` | 全局 state 读入口，允许跨包使用。 |
| `src/supports` | errors、parameters、factory、helper 等稳定支持层。 |
| `src/types` | 对外稳定类型和内部必要类型。 |
| `src/index.ts` | 短而清晰的公开面，优先导出 module、application、commands、selectors、supports、types。 |
| `test` | 单测、集成、live、重启恢复场景。 |

包根 `src/index.ts` 应该让开发者看一眼就知道：

1. 包的 `moduleName` 和 `packageVersion`。
2. 如何装配模块。
3. 包公开了哪些 commands。
4. 包有哪些 state slices 和 selectors。
5. 包有哪些 errors 和 parameters。
6. 哪些 foundations 是被允许稳定使用的少数公开基础设施。

不建议默认 `export * from './foundations'`。`foundations` 是内部实现层，只有明确稳定的能力才应该逐项导出。

## 五、统一 runtime 初始化

新版 runtime 推荐从 `runtime-shell-v2` 的 `createKernelRuntimeApp` 启动。

```ts
import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createTdpSyncRuntimeModuleV2} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {createTopologyRuntimeModuleV2} from '@impos2/kernel-base-topology-runtime-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import {createWorkflowRuntimeModuleV2} from '@impos2/kernel-base-workflow-runtime-v2'

const app = createKernelRuntimeApp({
    runtimeName: 'pos-main-runtime',
    platformPorts,
    modules: [
        createTcpControlRuntimeModuleV2(),
        createTdpSyncRuntimeModuleV2(),
        createTopologyRuntimeModuleV2(),
        createUiRuntimeModuleV2(),
        createWorkflowRuntimeModuleV2(),
    ],
})

await app.start()
```

`createKernelRuntimeApp` 的职责是：

1. 解析模块依赖顺序。
2. 执行模块 `preSetup`。
3. 输出启动阶段结构化日志。
4. 创建 `KernelRuntimeV2`。
5. 安装模块的 slices、actors、commands、parameters、errors。
6. hydrate state persistence。
7. 触发 runtime lifecycle 初始化。
8. 暴露 runtime descriptor 供调试和自检。

这不是旧 `ApplicationManager` 的复刻。它只是装配器，真正运行时能力仍在 `createKernelRuntimeV2` 和各个独立 runtime 包中。

## 六、Command / Actor 模型

新版模型继续继承旧工程“Command 是业务指令，Actor 是执行者”的理念，同时修正旧全局单例和结果难聚合的问题。

核心规则：

1. Command 是跨包写操作的正式接口。
2. Actor 是 command 的执行者。
3. 一个 command 可以被多个 actor 处理，runtime-shell-v2 聚合 actor 结果。
4. Actor 内可以继续 `dispatchCommand` 子命令，子命令也会进入同一套 request/command 观测体系。
5. command payload 应通过 definition 自动推导类型，减少业务开发者手动 cast。
6. request 状态以内存 `RequestLedger` 为主真相源，不强制写进 Redux。
7. UI 或业务层需要观察 request 时，使用 runtime 提供的 query/subscribe/selector 能力。
8. 需要跨机执行时，通过 topology peer dispatch gateway，而不是业务包自己写 RPC。

业务包定义 command/actor 的推荐方式：

```ts
import {
    createModuleActorFactory,
    createModuleCommandFactory,
    onCommand,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'

const defineCommand = createModuleCommandFactory(moduleName)
const defineActor = createModuleActorFactory(moduleName)

export const demoCommandDefinitions = {
    submitOrder: defineCommand('submit-order', {
        payload: {} as {orderId: string},
    }),
}

export const createDemoActor = () => defineActor('DemoActor', [
    onCommand(demoCommandDefinitions.submitOrder, async context => {
        const {orderId} = context.command.payload
        return {orderId, accepted: true}
    }),
])
```

注意事项：

1. 不要把 Actor 全部堆进 `features/actors/index.ts`，要按职责拆文件。
2. 不要跨包直接 import 对方 slice action。
3. 不要在业务 service 里绕开 command 直接改其他包 state。
4. 不要为了“单执行者”把业务模块互相硬依赖；需要广播事实时仍应使用 command/actor 模型。

## 七、Redux / State / Persistence 模型

`state-runtime` 保留 Redux 作为 kernel 核心真相源，但把持久化策略从业务逻辑中抽离。

业务 slice 只声明：

1. slice name。
2. 初始 state。
3. reducers。
4. 是否需要持久化。
5. 哪些字段持久化。
6. 哪些 record entry 动态持久化。
7. 是否使用 protected storage。
8. 是否参与 topology sync。

`state-runtime` 负责：

1. 创建 Redux store。
2. hydrate 本地状态。
3. 监听 state 变化。
4. debounce flush。
5. immediate flush。
6. field 级持久化。
7. record entry 级持久化。
8. 普通 storage 与 secure storage 分流。
9. 坏 JSON 或坏 entry 的容错恢复。

这样比旧 `redux-persist` 更适合当前业务，因为旧方式往往只能把整个 slice 存成一个大对象，容易导致对象过大、动态 record 难处理、敏感字段难分流加密。

业务开发注意：

1. state 必须保持 JSON 可序列化。
2. 时间字段存 long 毫秒。
3. token、凭证、敏感数据优先使用 protected persistence。
4. 动态对象优先按 record entry 存储，避免一个 key 过大。
5. 不需要手动调用“保存”，state 变化后由 runtime 自动持久化。
6. 重启恢复测试不能只测 HTTP 成功，要测 selector/state 恢复是否正确。

## 八、TDP Projection 模型

`tdp-sync-runtime-v2` 是终端数据平面同步仓库。

它维护的是全量业务 projection repository，而不是只维护当前生效快照。

TDP projection 的关键语义：

1. 服务端可对同一 topic、同一 itemKey 下发多个 scope 的数据。
2. 终端必须保存完整 projection 仓库，重启后才能重新计算生效值。
3. 生效优先级为 `Platform < Project < Brand < Tenant < Store < Terminal`。
4. repository 应按 projection id 或细粒度 key 存储，避免单条 state 过大。
5. 当 projection 数据变化后，runtime 根据优先级计算“当前生效变化”。
6. runtime 广播通用 `tdpTopicDataChanged` command。
7. 广播 payload 只包含业务模块关心的生效变化，不暴露 scope 求解细节。

典型广播 payload：

```ts
{
    topic: 'some.topic',
    changes: [
        {
            operation: 'upsert',
            itemKey: 'item-a',
            payload: {enabled: true},
            revision: 12,
        },
        {
            operation: 'delete',
            itemKey: 'item-b',
            revision: 13,
        },
    ],
}
```

业务模块接入方式：

1. 在自己的 actor 中监听 `tdpTopicDataChanged`。
2. 判断 `payload.topic` 是否属于自己。
3. 把 changes 转换成自己包内 slice 更新。
4. 不关心 scope 优先级如何计算。
5. 不直接依赖 TDP session、WS handshake、snapshot/change 原始协议。

只有 error catalog 和 parameter catalog 是基础层例外，因为 `runtime-shell-v2` 比 `tdp-sync-runtime-v2` 更早声明，它自己不监听 TDP command，所以由 `tdp-sync-runtime-v2` 的 system catalog bridge actor 调用 runtime-shell-v2 command 更新 catalog。

## 九、Topology 模型

`topology-runtime-v2` 管理主副机之间的活控制面。

它负责：

1. node hello / hello ack。
2. peer runtime info。
3. connection / reconnect / resume。
4. remote command dispatch。
5. request lifecycle mirror。
6. state sync summary / diff / commit ack。
7. masterInfo 等最小恢复信息。

它不负责：

1. 存储普通业务状态。
2. 解释业务 command result。
3. 管理 UI screen 具体渲染。
4. 替业务包决定哪些 state 应该同步。

业务 state 同步应由业务 slice 声明 sync intent，再由 `state-runtime` 和 `topology-runtime-v2` 协作完成。

重要设计点：

1. 旧工程里 `sendToRemoteExecute` 必须等远端确认开始执行后才结束，这个思路要保留。
2. 远端 command started/running/completed/failed 需要镜像回本机 request ledger，避免本机提前看到 request completed。
3. 离线重连不是简单 flush 队列，而是要通过 resume + request snapshot + state sync summary 重新建立事实。
4. `masterInfo` 这类最小恢复信息可以持久化，让 slave 重启后能重新找到 master。
5. 业务包需要跨机执行时，只声明 command target，不自己写 WebSocket RPC。

## 十、Transport 模型

`transport-runtime` 是 HTTP 和 WS 的通用 transport 基础设施。

HTTP runtime 提供：

1. server catalog。
2. 多地址选择。
3. preferred address 保持。
4. ordered failover。
5. retry rounds。
6. max concurrent。
7. rate limit。
8. metrics。
9. 结构化日志上下文。

Socket runtime 提供：

1. socket profile 注册。
2. URL 构造。
3. codec serialize / deserialize。
4. state-change / connected / message / disconnected / error 事件。
5. inbound/outbound message count。
6. connection metrics。

注意：

1. transport-runtime 不解析业务 envelope。
2. transport-runtime 不知道“订单提交成功”或“激活失败”。
3. transport-runtime 不决定某个业务是否应该无限重连。
4. 上层包通过 endpoint/profile/service binder 组合自己的协议。

HTTP 服务测试要求：

1. 所有 `1-kernel/1.1-base` 内 HTTP 测试都应使用 `1-kernel/server-config-v2` 提供地址。
2. 测试必须覆盖地址切换、失败重试、有效地址保持。
3. 不允许在测试里随手写一组临时 localhost 地址绕过 server config。

## 十一、UI Runtime 模型

`ui-runtime-v2` 是旧 `navigation` / `ui-runtime` 思想的新实现。

它在 kernel 层管理：

1. screen definitions。
2. screen runtime state。
3. overlay / modal / alert state。
4. workspace。
5. UI variables。
6. rendererKey。

它不管理：

1. React component。
2. React hook。
3. DOM。
4. RN View。
5. Electron BrowserWindow。
6. 页面 URL。

核心思想：

1. kernel 只知道 `rendererKey` 和 UI runtime state。
2. `2-ui` 或 assembly 负责把 `rendererKey` 映射成真实组件。
3. screen registry 可以是可变注册器，但只能存定义，不能存组件对象或副作用。
4. selector 根据 topology context、workspace、instanceMode、displayMode 计算当前 UI 应该展示什么。

上层写 UI 业务包时：

1. 在 kernel business 包声明 screen/overlay/alert/variable。
2. 在 `2-ui` 声明 rendererKey 到组件的映射。
3. 用 command 改 UI state。
4. 用 selector 读当前 screen、overlay、variable。
5. 不要把 React component 放进 kernel state。

## 十二、Workflow 模型

`workflow-runtime-v2` 提供轻量动态 workflow runtime。

它的核心不是“最后返回一个 result”，而是：

1. `run` 直接返回 `Observable<WorkflowObservation>`。
2. Observable 持续发射等待、运行、步骤、错误、完成等状态。
3. selector 输入 requestId 后返回同一份 observation。
4. workflow 严格串行运行。
5. 第二个 workflow 可以 run，但会先进入 `WAITING_IN_QUEUE`。
6. definitions 可以来自 module、host、remote TDP topic、test。
7. 动态 JS 脚本优先由 `platformPorts.scriptExecutor` 执行。
8. 没有宿主 scriptExecutor 时，本地 `new Function` 只作为测试和兜底能力。

业务开发注意：

1. workflow definition 要明确输入、输出、context、step output。
2. UI 观察 workflow 不应自己维护第二套 loading/result state。
3. 远端下发 workflow definitions 时，应走 TDP topic 更新 definitions state。
4. 执行时必须使用最新 definition。
5. 异常、重复 requestId、队列上限、脚本超时都要有测试覆盖。
6. 这是内部受控系统，script 不需要过度限制，但必须通过 adapter/host 提供合适执行边界。

## 十三、Error Messages 与 System Parameters

基础包必须把 errorMessages 和 systemParameters 当成正式设计对象，而不是写死字符串。

推荐规则：

1. 每个包在 `src/supports/errors.ts` 定义自己的 error definitions。
2. 每个包在 `src/supports/parameters.ts` 定义自己的 parameter definitions。
3. 定义时使用 helper/factory 减少字符串拼接。
4. 业务逻辑引用 definition object，不直接写 key 字符串。
5. 静态 definition 是 fallback 真相。
6. runtime catalog 是当前动态覆盖值。
7. TDP 可下发 error catalog / parameter catalog topic。
8. `definition-registry` 统一负责 decode、validate、fallback。
9. PROD 日志默认脱敏，DEV 才允许敏感原文。

常见 parameter 场景：

1. HTTP retry rounds。
2. WS reconnect interval。
3. WS reconnect attempts。
4. request timeout。
5. workflow queue size。
6. workflow script timeout。
7. observation history limit。
8. topology remote command response timeout。

## 十四、Logger 规则

日志要服务于未来后台统一日志管理，所以必须结构化。

推荐日志字段：

1. `category`：大类，例如 `runtime.load`、`transport.http`、`tdp.connection`。
2. `event`：具体事件，例如 `request-started`、`module-installed`。
3. `message`：短消息，方便人读。
4. `context`：requestId、commandId、nodeId、peerNodeId、connectionId、sessionId。
5. `data`：可观测业务数据。
6. `error`：错误 name、code、message、stack。

注意：

1. 不要业务自己拼长字符串日志。
2. 尽量使用 logger scope 和 helper。
3. DEV 可以记录敏感原文。
4. PROD 必须默认脱敏。
5. command、request、HTTP、WS、TDP、topology、workflow 都应带 requestId/commandId 等上下文。

## 十五、各子包说明

### contracts

包名：`@impos2/kernel-base-contracts`

定位：跨包共享语言层。

它负责：

1. ID、时间、validator。
2. AppError 和错误视图协议。
3. ErrorCatalogEntry、ParameterCatalogEntry。
4. request、command、topology、state-sync envelope。
5. protocolVersion、packageVersion 等稳定协议字段。

设计亮点：

1. 把共享语言和运行实现分离。
2. 避免基础包之间互相依赖内部 foundations。
3. 让 topic payload、workflow payload、topology envelope、request mirror 具有共同语义。

注意：

1. contracts 不能依赖 runtime-shell、Redux、platform ports。
2. 能抽成稳定协议的对象优先放这里。
3. 不稳定的 runtime 实现不要放这里。

上层使用：

1. 业务包定义 command payload、topic payload、workflow input/output 时优先复用 contracts 类型。
2. 业务包生成时间和 ID 时使用 contracts helper。
3. 业务包抛错时使用统一 AppError 定义。

### definition-registry

包名：`@impos2/kernel-base-definition-registry`

定位：error/parameter 定义注册与解析层。

它负责：

1. 注册静态 error definitions。
2. 注册静态 parameter definitions。
3. 使用 catalog 覆盖静态定义。
4. 参数 rawValue decode。
5. 参数 validate。
6. fallback 到 defaultValue。
7. error template render。

设计亮点：

1. 静态定义与动态 catalog 解耦。
2. decode/validate/fallback 只有一个实现。
3. runtime-shell 和业务模块不需要自己解释 catalog。

注意：

1. number decode 必须拒绝非法数值。
2. boolean/json/string 解析应走统一入口。
3. appError key 和目标 key 不一致时应该显式失败。

上层使用：

1. 业务包新增 parameter 时必须给 defaultValue、valueType、validate。
2. 业务包不要自己读取 raw catalog 后手动 parse。
3. UI 展示错误时应解析成 ResolvedErrorView。

### execution-runtime

包名：`@impos2/kernel-base-execution-runtime`

定位：低层 command 执行原语。

它负责：

1. handler 注册。
2. middleware 链。
3. command lifecycle。
4. execution journal。
5. error normalization。

设计亮点：

1. 保留命令生命周期可观测能力。
2. 与 Redux、topology、业务路由完全解耦。
3. 可作为 runtime-shell 更高层 command bus 的底层能力。

注意：

1. 普通业务包通常不直接依赖它。
2. handler not found 当前是执行契约的一部分，不能随意改成 failed result。
3. middleware 不能重入。

上层使用：

1. 业务模块优先使用 runtime-shell-v2 的 command/actor DSL。
2. 只有做更底层执行器实验或基础设施时才直接使用 execution-runtime。

### host-runtime

包名：`@impos2/kernel-base-host-runtime`

定位：双机 host 纯控制面内核。

它负责：

1. pairing ticket。
2. session registry。
3. connection attach/detach。
4. resume begin/complete。
5. relay queue。
6. fault injection。
7. host observability。

设计亮点：

1. Host 语义和 HTTP/WS server 适配拆开。
2. `0-mock-server/dual-topology-host` 和终端内置 host 可以复用同一内核。
3. relay 支持对端离线时缓存与重绑。
4. fault registry 支持复杂双机测试。

注意：

1. 它不启动 server。
2. 它不负责业务 command 执行。
3. 它不应该被普通业务包依赖。

上层使用：

1. mock server 或未来主屏内置 host 使用它。
2. 业务包只通过 topology-runtime-v2 感知双机能力。

### platform-ports

包名：`@impos2/kernel-base-platform-ports`

定位：kernel 到宿主平台的端口层。

它负责定义：

1. logger。
2. stateStorage。
3. secureStateStorage。
4. environmentMode。
5. time 相关能力。
6. scriptExecutor。
7. connector/host 扩展能力。

设计亮点：

1. kernel 不绑定 Android/Web/Node/Electron。
2. 敏感存储和普通存储可分流。
3. workflow 动态脚本可交给宿主安全执行。
4. logger 可统一脱敏、结构化、上传。

注意：

1. kernel 包不能偷用平台 API。
2. 新平台能力应先考虑是否该进入 ports。
3. ports 是能力边界，不是业务服务容器。

上层使用：

1. adapter/assembly 在启动时注入具体实现。
2. business runtime 通过 context.platformPorts 使用能力。
3. 不在业务包里直接调用浏览器/Android/Electron API。

### runtime-shell-v2

包名：`@impos2/kernel-base-runtime-shell-v2`

定位：新版 kernel 唯一 runtime shell。

它负责：

1. createKernelRuntimeApp。
2. createKernelRuntimeV2。
3. module ordering。
4. preSetup/install lifecycle。
5. Redux state runtime 装配。
6. Command/Actor 广播执行。
7. request ledger。
8. parameter resolver。
9. error/parameter catalog state。
10. state sync interface。
11. peer dispatch gateway。

设计亮点：

1. 保留旧工程模块装配入口清晰的优点。
2. 不再使用多个全局 manager。
3. command 可以广播给多个 actor 并聚合 result。
4. actor 内可以继续 dispatchCommand。
5. request ledger 在内存中保持同步、可订阅、可查询。
6. module manifest/descriptor 让包能力清单可读。

注意：

1. 不要让它再次膨胀成第二个 ApplicationManager。
2. 业务初始化应在模块 install/preSetup 或 lifecycle command 中完成。
3. 不要跨包调用 internal action。

上层使用：

1. 所有 runtime 包通过 `createXxxModuleV2` 接入。
2. 业务包使用 command/actor DSL。
3. 业务包用 selector 读 state，用 command 写 state。

### state-runtime

包名：`@impos2/kernel-base-state-runtime`

定位：Redux、持久化、同步声明的统一基座。

它负责：

1. createStateStore。
2. hydrate。
3. flushPersistence。
4. field persistence。
5. record persistence。
6. secure persistence。
7. replace state patch。
8. sync slice 元数据承接。

设计亮点：

1. 持久化粒度比 redux-persist 更细。
2. 动态 Record state 可以按 entry 存储。
3. token 等敏感字段可以走 secure storage。
4. 坏 entry 不应导致整体 hydrate 失败。

注意：

1. slice state 必须可序列化。
2. 不要把超大对象塞进单字段持久化。
3. 不要业务手写 storage 同步。

上层使用：

1. 业务 slice 声明 persistIntent 和 persistence descriptors。
2. 需要主副同步的 slice 声明 syncIntent。
3. 重启恢复测试要验证 selector/state 语义。

### tcp-control-runtime-v2

包名：`@impos2/kernel-base-tcp-control-runtime-v2`

定位：终端控制平面 runtime。

它负责：

1. terminal activation。
2. binding state。
3. identity state。
4. credential refresh。
5. task result report。
6. TCP control HTTP service facade。

设计亮点：

1. 控制平面通过 command 暴露。
2. HTTP 地址、failover、retry 复用 transport-runtime。
3. 凭证状态可持久化恢复。
4. credential refresh 失败后回到可重试状态。

注意：

1. 不承担 TDP 数据同步。
2. 不承担 topology peer 通讯。
3. 不直接绑定 mock-terminal-platform。

上层使用：

1. 业务通过 command 激活终端、刷新凭证、上报 task result。
2. 业务通过 selector 读取 terminalId、accessToken、binding、credential。
3. HTTP 测试使用 `server-config-v2`。

### tdp-sync-runtime-v2

包名：`@impos2/kernel-base-tdp-sync-runtime-v2`

定位：终端数据平面同步 runtime。

它负责：

1. TDP HTTP snapshot。
2. TDP HTTP changes。
3. TDP WS session。
4. HANDSHAKE。
5. reconnect。
6. full projection repository。
7. effective projection calculation。
8. `tdpTopicDataChanged` 广播。
9. error/parameter catalog bridge。

设计亮点：

1. 终端存全量 projection 仓库，重启后可重新计算。
2. topic + itemKey + scope 支持真实业务模型。
3. 业务只接收当前生效变化。
4. WS 真实场景默认无限重连，测试可覆盖有限重连。
5. system catalog bridge 把基础动态配置接回 runtime-shell。

注意：

1. 不要主动调用普通业务模块 command。
2. 不要让业务包关心 raw scope 优先级。
3. HANDSHAKE 必须在 socket connect resolve 后发送，避免 transportConnection 尚不可用。

上层使用：

1. 业务 actor 监听 `tdpTopicDataChanged`。
2. 根据 topic 过滤自己的数据。
3. 把 changes 写入自己的 slice。
4. 需要直接读远端配置时使用 resolved projection selector。

### topology-runtime-v2

包名：`@impos2/kernel-base-topology-runtime-v2`

定位：主副机拓扑 runtime。

它负责：

1. instanceMode。
2. displayMode。
3. workspace。
4. masterInfo。
5. peer connection。
6. remote command dispatch。
7. request lifecycle mirror。
8. state sync resume。
9. continuous state sync。

设计亮点：

1. 合并旧 topology client runtime，减少包拆分。
2. 主副机 request 状态可以正确接续，不会本机提前完成而远端刚开始。
3. resume 不是简单 flush，而是 request snapshot + state summary/diff。
4. topology 只做控制面，不偷业务状态职责。

注意：

1. masterInfo 可持久化，用于 slave 重启后自动连接。
2. topology state 不是业务数据仓库。
3. 业务不要自建 WebSocket RPC。

上层使用：

1. command 需要本机或 peer 执行时，通过 runtime/topology target 语义表达。
2. slice 需要主副同步时声明 syncIntent。
3. UI/context 读取 instanceMode、displayMode、workspace selector。

### transport-runtime

包名：`@impos2/kernel-base-transport-runtime`

定位：HTTP/WS transport 基础设施。

它负责：

1. endpoint/profile 定义。
2. HTTP URL build。
3. Socket URL build。
4. server catalog。
5. HTTP retry/failover/preferred address。
6. HTTP concurrency/rate limit。
7. Socket lifecycle。
8. metrics。

设计亮点：

1. 复用旧 communication 包里已经建设好的 HTTP/WS 基础设施思想。
2. transport 和业务完成语义彻底分离。
3. 上层 runtime 不需要重复造轮子。

注意：

1. 不处理业务 envelope。
2. 不知道业务 code。
3. 不在这里写 TDP/TCP/topology 特定逻辑。

上层使用：

1. 定义 endpoint/profile。
2. 组合自己的 service facade。
3. 业务错误在业务 runtime 处理。

### ui-runtime-v2

包名：`@impos2/kernel-base-ui-runtime-v2`

定位：UI runtime 基础能力。

它负责：

1. screen registry。
2. screen runtime state。
3. overlay/modal/alert。
4. UI variables。
5. workspace/context filtering。
6. rendererKey 协议。

设计亮点：

1. 继承旧 navigation 的 screen part 思想。
2. 状态与渲染彻底分离。
3. kernel 不依赖 React。
4. 支持多屏、workspace、instance/display 上下文。

注意：

1. registry 只存定义，不存组件。
2. 不要把 React hook 放进 kernel。
3. UI state 是 kernel state，具体渲染是 `2-ui` 职责。

上层使用：

1. business 包声明 UI screen/overlay/alert/variable。
2. `2-ui` 提供 rendererKey 到组件的映射。
3. assembly 组合最终运行环境。

### workflow-runtime-v2

包名：`@impos2/kernel-base-workflow-runtime-v2`

定位：动态 workflow runtime。

它负责：

1. workflow definitions state。
2. remote definitions topic。
3. serial queue。
4. Observable observation。
5. step execution。
6. script execution。
7. connector execution。
8. run/cancel/definition update commands。

设计亮点：

1. run 返回 Observable，过程和结果统一可观察。
2. selector by requestId 与 Observable 使用同一 observation 真相。
3. workflow 串行，排队状态明确。
4. definitions 可动态下发，执行时使用最新定义。
5. scriptExecutor 通过 platform port 注入。

注意：

1. 不要在 UI 再维护一套 workflow result。
2. 动态脚本是受控内部能力，但异常和超时必须明确处理。
3. queue、duplicate requestId、definition missing 都应有测试。

上层使用：

1. 业务提供 workflow definitions。
2. 业务通过 command 或 runtime facade 执行 workflow。
3. UI 订阅 observation 或 selector。
4. 远端更新 definitions 时通过 TDP topic 进入 state。

## 十六、未来业务包开发指南

未来 `1-kernel/1.2-business` 包推荐按下面方式建设。

### 1. 包结构

```text
src/
  application/
    createModule.ts
    moduleManifest.ts
    index.ts
  features/
    commands/
    actors/
    slices/
  foundations/
  selectors/
  supports/
    errors.ts
    parameters.ts
  types/
  moduleName.ts
  index.ts
test/
  scenarios/
  helpers/
  index.ts
```

### 2. 业务包应该做什么

1. 定义自己的 moduleName。
2. 定义自己的 commands。
3. 定义自己的 actors。
4. 定义自己的 slices。
5. 定义自己的 selectors。
6. 定义自己的 errors 和 parameters。
7. 声明持久化字段。
8. 声明同步意图。
9. 如果需要远端配置，消费 `tdpTopicDataChanged`。
10. 如果需要 UI，声明 rendererKey 和 UI runtime state。
11. 如果需要 workflow，注册 definitions 或消费 remote definitions。

### 3. 业务包不应该做什么

1. 不直接依赖旧 `1.1-cores`。
2. 不跨包 import 其他包 slice action。
3. 不自建 Redux store。
4. 不自建 redux-persist。
5. 不自建 TDP websocket。
6. 不自建 topology websocket RPC。
7. 不把 React component 放进 kernel state。
8. 不在 business 包硬编码服务器地址。
9. 不在业务逻辑里散落 error key、parameter key 字符串。
10. 不绕过 platform-ports 直接访问宿主 API。

## 十七、测试与联调规则

基础包测试要覆盖真实语义，而不是只测函数返回。

通用规则：

1. 单元测试覆盖纯函数、selector、resolver、factory。
2. scenario 测试覆盖 command -> actor -> state -> selector。
3. live 测试覆盖真实 mock server。
4. 重启恢复测试采用 `full / seed / verify` 模式。
5. 双屏通讯测试必须开启 `0-mock-server/dual-topology-host`。
6. TCP/TDP 测试必须配合 `0-mock-server/mock-terminal-platform`。
7. HTTP 地址切换测试必须使用 `1-kernel/server-config-v2`。
8. WS 真实场景默认无限重连，测试场景可以传有限次数参数。
9. 测试不同复杂场景时要拆不同 spec 文件，不要堆在一个大文件里。
10. bug 修复必须有回归测试；被判定不是 bug 的争议点，也应尽量加保护性测试锁定契约。

重点场景：

1. HTTP 地址失败、重试、切换、有效地址保持。
2. WS 断线、无限重连、有限测试重连。
3. TCP 激活、凭证刷新失败、刷新恢复。
4. TDP snapshot、changes、projection upsert/delete、scope 优先级、topic 广播。
5. error catalog / parameter catalog topic 下发。
6. workflow definitions topic 下发、更新后执行最新定义。
7. topology remote command、request lifecycle mirror、state sync resume。
8. UI screen/overlay/variable 在不同 workspace/instance/display 下的 selector 语义。
9. persistence hydrate 后 selector 是否恢复正确。

## 十八、参考文档

建议阅读顺序：

1. [`refactor-doc/2026-04-14-kernel-base-application-structure-design.md`](../../refactor-doc/2026-04-14-kernel-base-application-structure-design.md)
2. [`refactor-doc/2026-04-14-kernel-base-application-structure-implementation.md`](../../refactor-doc/2026-04-14-kernel-base-application-structure-implementation.md)
3. [`refactor-doc/2026-04-14-kernel-base-module-dsl-alignment.md`](../../refactor-doc/2026-04-14-kernel-base-module-dsl-alignment.md)
4. [`refactor-doc/2026-04-14-kernel-base-v2-foundation-gap-audit.md`](../../refactor-doc/2026-04-14-kernel-base-v2-foundation-gap-audit.md)
5. [`refactor-doc/2026-04-14-topology-tdp-connection-lifecycle-simplification-design.md`](../../refactor-doc/2026-04-14-topology-tdp-connection-lifecycle-simplification-design.md)
6. [`refactor-doc/2026-04-14-workflow-runtime-v2-engine-simplification.md`](../../refactor-doc/2026-04-14-workflow-runtime-v2-engine-simplification.md)
7. [`refactor-doc/2026-04-14-ui-runtime-v2-design.md`](../../refactor-doc/2026-04-14-ui-runtime-v2-design.md)
8. [`ai-result/2026-04-08-base-package-design-review.md`](../../ai-result/2026-04-08-base-package-design-review.md)
9. [`ai-result/2026-04-08-interconnection-package-design-review.md`](../../ai-result/2026-04-08-interconnection-package-design-review.md)
10. [`ai-result/2026-04-15-kernel-base-bug-review-adjudication.md`](../../ai-result/2026-04-15-kernel-base-bug-review-adjudication.md)

## 十九、当前结论

`1-kernel/1.1-base` 已经具备承接旧 core 能力和后续业务包迁移的基础形态。

后续新增基础能力时，优先判断它属于哪一层：

1. 是跨包共享语言，放 `contracts`。
2. 是平台能力边界，放 `platform-ports`。
3. 是错误/参数定义解析，放 `definition-registry`。
4. 是 Redux/persistence/sync substrate，放 `state-runtime`。
5. 是 command/actor/module/request runtime，放 `runtime-shell-v2`。
6. 是 HTTP/WS transport，放 `transport-runtime`。
7. 是 TCP 控制面，放 `tcp-control-runtime-v2`。
8. 是 TDP 数据面，放 `tdp-sync-runtime-v2`。
9. 是主副机控制面，放 `topology-runtime-v2`。
10. 是 UI runtime 协议，放 `ui-runtime-v2`。
11. 是 workflow runtime，放 `workflow-runtime-v2`。
12. 如果只是业务规则，不要放进 base，应该进入未来 `1-kernel/1.2-business`。
