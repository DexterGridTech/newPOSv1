# 核心基础包重构必须继承并超越的旧设计亮点

## 1. 文档目标

本文档用于从以下两份评审文档中提炼“旧工程真正做对了什么”：

- [ai-result/2026-04-08-base-package-design-review.md](/Users/dexter/Documents/workspace/idea/newPOSv1/ai-result/2026-04-08-base-package-design-review.md)
- [ai-result/2026-04-08-interconnection-package-design-review.md](/Users/dexter/Documents/workspace/idea/newPOSv1/ai-result/2026-04-08-interconnection-package-design-review.md)

本文档不是复述旧问题清单，而是把旧 `base` 和 `interconnection` 中已经被业务长期验证有效的设计亮点，整理成后续重构必须遵守的架构继承约束。

本文档的作用有三点：

1. 防止重构时只看到旧包缺点，却把真正有价值的核心思想一起拆掉。
2. 把“旧工程经验”升级成“新架构必须显式满足的设计要求”。
3. 为后续 `1-kernel/1.1-base/*`、`runtime-shell`、`topology-runtime`、`dual-topology-host` 的详细设计与实现提供检查表。

---

## 2. 总体结论

旧 `base` 和 `interconnection` 虽然结构过重、边界过宽、全局化严重，但它们并不是“方向错了，只是实现得乱”。

它们真正成功的地方在于：

1. 用统一运行时协议把整个 monorepo 的 kernel、ui、assembly、adapter 串进了同一个执行体系。
2. 用 command 驱动而不是 service 直连，支撑了跨包、跨端、跨阶段的业务链路。
3. 用统一上下文语言把 POS 多屏、多实例、多 workspace 场景稳定抽象出来。
4. 用低接入成本的同步与适配约定，让大量业务包不需要各自重写主副机协同基础设施。
5. 用 request 级观测把“本端发起、远端执行、本端观察”这类真实业务链路变成可追踪对象。

因此，第一阶段重构的正确目标不是“摆脱旧设计”，而是：

1. 继承旧设计已经被验证有效的运行时哲学。
2. 把这些哲学从“靠全局单例、隐式约定、大包兜住”升级成“显式协议、职责清晰、可验证”的新基础架构。

一句话总结：

旧架构最值得保留的是“统一语言与统一运行时思想”，最需要升级的是“边界、协议、实例化、验证体系”。

---

## 3. 必须继承的旧设计亮点

## 3.0 统一命名空间必须保留

旧工程里 `moduleName` 的价值不能被误判成历史包袱。

它长期承担的是：

1. 模块级稳定命名空间。
2. command / actor / state key / log tag 的统一前缀。
3. 跨包协作时可静态引用的模块标识。

重构后必须继承：

1. 所有包继续保留 `src/moduleName.ts`。
2. `moduleName` 继续作为公开常量导出。
3. 命名空间规则继续保持层级化、可预测、跨仓库一致。

重构后必须超越：

1. `moduleName` 不再只是旧 `AppModule.name` 的附属字段，而是统一结构硬约束。
2. 新 `1-kernel/1.1-base/*` 要采用稳定的新命名空间前缀，而不是沿用旧 `kernel.core.*`。
3. 包结构、对外导出、脚手架生成规则都必须内建 `moduleName`，不允许靠人工补齐。

## 3.1 模块 manifest 化必须保留

旧 `base` 的最大亮点不是某个工具函数，而是 `AppModule` 这类模块 manifest 思想。

它带来的核心价值是：

1. 业务包主要负责“声明自己有什么”，而不是自己拼 runtime。
2. 模块依赖可以被静态描述与统一解析。
3. 上游装配入口可以围绕统一模块协议工作，而不是为每个包写一套启动胶水。
4. 下游包可以共享同一套启动、持久化、middleware、selector 暴露方式。

重构后必须继承：

1. 继续存在统一模块契约。
2. 模块仍应以 manifest/descriptor 形式进入 runtime。
3. 模块依赖关系仍应可静态解析。

重构后必须超越：

1. 模块契约必须从旧 `base` 大一统协议中拆成更清晰的公开 contracts。
2. 模块装配必须进入 runtime 实例，而不是挂在全局 `ApplicationManager` 上。
3. 模块契约必须按职责拆层，不再把 UI、transport、topology、platform 全塞进一个通用 module 类型里。

---

## 3.2 command 驱动体系必须保留

旧工程一个非常正确的决策，是让 command 成为跨模块协作的统一主语。

它的长期价值已经被多个包反复验证：

1. `tcp-client`、`tdp-client` 这类链式流程天然适合 command 编排。
2. `ui-runtime`、`navigation`、`task` 等包都依赖 command 驱动状态变化。
3. 跨包调用不需要退化成互相直接 import service。
4. request 级上下文可以沿命令链传递，而不是散落在局部参数里。

重构后必须继承：

1. 继续以 command 作为系统执行与协作主语。
2. 继续保留 request 级上下文贯穿整条命令链。
3. 继续支持 parent/child command 关系。

重构后必须超越：

1. command 执行必须变成 runtime-scoped，而不是全局 `commandBus + ActorSystem`。
2. handler 决策与执行结果必须成为一等协议，而不是主要靠 lifecycle listener 旁路补写。
3. child command 不再走隐式 `executeFromParent` 风格，而要进入显式 execution context。
4. command 的 accepted、started、completed、failed 等状态必须有正式语义，不再混在 transport ack 与 request projection 中。

这条能力还必须补上一条旧工程中长期成立但未明文写下的边界规则：

1. `state` 可以被全局读取。
2. 跨包写状态不能直调对方 `slice action`。
3. 跨包写必须通过对方公开 `command` 进入。
4. 想跨包触发状态变化，必须先调用目标包 command，再由目标包内部 actor/slice 完成落地。

---

## 3.3 统一运行时装配思想必须保留

旧 `ApplicationManager` 过重，但“统一 runtime 装配”这个思想本身是对的。

它解决了几个非常现实的问题：

1. 上游 assembly/adapter 只需要提供平台能力和模块列表。
2. 核心 store、persist、middleware、registry、actors 的装配顺序是统一的。
3. 启动链路有固定入口，便于日志、排障和约束。

重构后必须继承：

1. 必须保留统一总装配入口。
2. 上游仍应通过统一入口创建运行时，而不是自行拼多个 manager。
3. 初始化顺序仍需明确、可观察、可验证。

重构后必须超越：

1. 总装配入口只能有一个，即 `runtime-shell`。
2. `runtime-shell` 内部必须拆出子系统边界，不再重演 `ApplicationManager` 超重流程。
3. store、registry、execution、topology、transport 必须是显式 runtime 子系统，而不是同一个类里的连续步骤。
4. 初始化日志必须保留，但要围绕 runtime 子系统阶段输出，而不是围绕历史大类堆叠。

---

## 3.4 adapter 注入方向必须保留

旧工程在平台边界上的大方向是成熟的。

不论是 `logger`、`device`、`stateStorage`、`appControl`，还是 `localWebServer`，它们都体现了一个正确原则：

1. kernel 不直接依赖 Electron、Android、RN 具体平台 API。
2. 平台能力应该由 adapter/assembly 注入。
3. 同一套 kernel runtime 应可运行在不同宿主环境。

重构后必须继承：

1. 平台能力继续走 port/adapter 模式。
2. `localWebServer` 这类宿主能力继续保持平台无关。
3. 主屏内置宿主和 Node mock 宿主必须共享同一组 host port 语义。

重构后必须超越：

1. adapter 不再通过全局 `registerXxx` 槽位写入。
2. 所有 ports 必须进入 runtime-scoped `platform-ports` 容器。
3. 缺失 port 的行为必须显式分环境处理，不允许生产环境静默 fallback 到 mock。
4. 必填 port、可选 port、dev-only port 必须在 contracts 中显式区分。
5. logger 必须从“tags + 文本”升级成结构化事件模型，并明确 `DEV raw / PROD masked` 规则。
6. helper 必须足够重，避免业务代码手工拼大量日志字段。

---

## 3.5 timestamp-based 同步思想必须保留

旧 `base + interconnection` 共同沉淀出的 `ValueWithUpdatedAt + batchUpdateState + workspace slice + sync middleware` 方法论，已经在多个包上证明有效。

这套设计真正有价值的地方，不是它当前实现细节，而是它抓住了两个业务事实：

1. 主副机状态同步不是通用数据库复制，而是围绕顶层业务字段的有向传播。
2. 对当前 POS 场景来说，顶层字段级别的时间戳比较已经足够实用。

重构后必须继承：

1. 继续保留 timestamp-based 冲突比较思想。
2. 继续允许 workspace/read-model 状态按顶层字段进行同步。
3. 继续让业务包低成本接入同步，而不是要求每个包自己写 transport 协议。

重构后必须超越：

1. `updatedAt` 规则必须从“团队默契”升级为“显式同步 contract”。
2. 新架构要把默认同步 adapter 和自定义同步 adapter 区分开。
3. `null`、delete、tombstone、patch 语义必须显式，不再混成一个粗糙的 `batchUpdateState` 约定。
4. request 正确性不能继续依赖这套同步机制，request 真相必须回到 owner-ledger。
5. 所有同步相关时间字段都必须明确为毫秒时间戳数字，不允许字符串化存储。

---

## 3.5A 统一时间语义必须保留并升级

旧工程虽然没有把这件事写成硬规则，但实际上已经长期按下面方式工作：

1. `updatedAt / createdAt / occurredAt / expiresAt` 大量字段已经使用 `Date.now()` 语义。
2. `time.ts` 的存在说明时间格式化本来就应该是展示 helper，而不是存储真相。

重构后必须继承：

1. 继续以毫秒时间戳数字作为运行时时间真相。
2. 继续允许统一 helper 格式化时间文本。

重构后必须超越：

1. 时间字段必须被正式命名为统一 contract，而不是继续靠习惯维持。
2. state、protocol、persistence 中不再允许存格式化时间字符串。
3. 日志和 UI 展示统一走格式化 helper，不允许反向污染运行时真相。

---

## 3.5B 统一运行时 ID 语言必须保留并升级

旧工程里 `requestId / commandId / sessionId / nodeId` 以及各种 `shortId()` 调用点，已经说明系统离不开统一 ID 语言。

它真正做对的地方是：

1. command、task、UI、adapter 都围绕同一批上下文字段协作。
2. request 观测、日志、主副机协议都依赖这些 ID。

重构后必须继承：

1. `RequestId / CommandId / SessionId / NodeId` 继续作为正式公开语义存在。
2. 产品 runtime 四层继续共享同一套 ID 语言。

重构后必须超越：

1. 统一的不再只是“字符串长得差不多”，而是统一 helper、统一命名、统一字段位置。
2. 统一 ID 方案的作用域必须清楚限定在 `1-kernel / 2-ui / 3-adapter / 4-assembly`。
3. `0-mock-server` 只做协议兼容，不复用产品 runtime 的统一 ID 生成实现。

---

## 3.6 POS 多屏拓扑是一等概念必须保留

旧 `interconnection` 最成功的地方，不是 WebSocket 本身，而是它非常准确地抓住了 POS 多屏业务的真实问题。

它没有抽象成浏览器 route，也没有抽象成泛化分布式系统，而是直接围绕下面这些概念建模：

1. `master / slave`
2. `primary / secondary`
3. `main / branch`
4. 哪些状态在哪一端生效
5. 哪些命令在哪一端执行

这套产品抽象是高度贴合业务的，必须保留。

重构后必须继承：

1. 主副拓扑必须继续是一等概念。
2. 多屏上下文语言必须继续保留统一命名和统一语义。
3. 下游业务包不应自己重复推导主副路由逻辑。

重构后必须超越：

1. 上下文语言必须放进 `contracts`，不再散落在 `interconnection` helper 与下游 augment 中。
2. `workspace`、`instanceMode`、`displayMode` 必须区分真相源、派生态与路由策略，不再既存又算。
3. 命令路由策略必须显式化，不能再主要依赖“默认 MAIN -> MASTER”这类隐藏规则。

---

## 3.7 统一上下文语言必须保留

旧 `interconnection` 之所以影响面巨大，是因为它提供了整仓库通用的上下文语言：

1. `InstanceMode`
2. `DisplayMode`
3. `Workspace`
4. `SyncType`

这件事的战略价值很高。统一语言比某个具体实现更值得保留。

重构后必须继承：

1. 新架构必须继续提供统一上下文语言。
2. 新语言必须让 `ui-runtime`、后续业务模块、宿主协议、selector、command routing 说同一种话。

重构后必须超越：

1. 这些上下文类型不能只停留在枚举，要成为正式公开协议对象的一部分。
2. 上下文传播必须从“命令魔法补值”升级成“显式 routing context + 默认值策略”。
3. 控制面上下文和本地 projection context 必须分层，不再由同一批 slice 字段混合承载。

---

## 3.8 业务包低成本接入主副协同必须保留

旧 `interconnection` 一个非常实用的优点，是业务包不需要亲自写配对、WebSocket、patch apply、peer routing，就能参与主副协同。

业务包通常只要：

1. 声明 `syncType`
2. 使用 workspace slice
3. 走统一 dispatch helper
4. 遵守顶层字段同步规则

这显著降低了业务接入成本。

重构后必须继承：

1. 同步与拓扑协同仍然要尽量从业务包中抽离。
2. `ui-runtime`、后续模块仍应通过统一 contracts 和 runtime helper 低成本接入。

重构后必须超越：

1. 低成本不能再建立在隐式约定和全局 middleware 之上。
2. 下游包接入同步和路由时，必须拿到更显式的 contract 和更可测试的 helper。
3. 业务包必须清楚自己接入的是 projection sync、topology route 还是 remote execution，而不是都揉在一个包里。

---

## 3.9 跨端 request 观测能力必须保留

旧 `interconnection` 的 `requestStatus` 虽然实现方式有问题，但它体现了一个极其重要的业务能力：

1. 本端可以发起 request。
2. request 的 child command 可以在远端执行。
3. UI 和 task 仍然需要在本端统一观测这一整条 request 链路。

这不是“loading 状态”问题，而是跨端执行链路的统一观测问题。

重构后必须继承：

1. request 级观测必须继续存在。
2. 一个 request 下多 command、多节点状态必须可统一聚合。
3. UI、task、selector 仍需能以稳定方式观察 request 结果和进度。

重构后必须超越：

1. request 真相源必须由 owner-ledger 持有，不再依赖跨机 slice 合并。
2. `accepted` 与 `completed` 必须显式分层，transport ack 不再冒充业务完成。
3. request projection 必须成为正式读模型，由 `runtime-shell` 暴露 selector。
4. projection mirror 必须是能力开关，而不是正确性的前提。

---

## 3.10 远程命令仍应保留 command 风格

旧 `interconnection` 的隐式远程命令路由虽然过于魔法，但方向是对的：

1. 远程执行仍然应该体现为 command routing。
2. 业务层不应该散落大量裸 websocket 调用。

重构后必须继承：

1. 远程执行继续沿用 command 模型。
2. topology-runtime 继续承担 route planner 与 remote dispatch 的角色。
3. 远程事件继续围绕 command lifecycle 回传。

重构后必须超越：

1. 远程执行的 route、target、owner、source 必须显式进入协议。
2. `sendToRemoteExecute` 这类 transport completion 混合体不再保留。
3. remote dispatch、command event、projection mirror 必须拆成不同 envelope。

---

## 3.11 pair host 模型必须保留

旧 `master-ws-server-dual` 虽然是 mock 服务，但它已经把“主副机成对配对、成对转发、成对观测”的宿主语义跑通了。

这类模型非常适合当前业务，而不是通用消息中间件。

重构后必须继承：

1. `dual-topology-host` 继续使用 pair host 思路。
2. ticket、hello/ack、心跳、断线重连窗口、观测、故障注入都应保留。
3. Node 版宿主与后续主屏内置宿主必须遵循同一组 host 协议。

重构后必须超越：

1. host 只承载 pairing、session、relay、observability、fault injection，不承担 request owner 聚合。
2. 兼容性判断必须进入 hello/ack 协议，不再只是连接能通就算可用。
3. projection mirror、dispatch/event relay 必须协议化，不再只是裸消息透传。

---

## 3.12 启动与运行期可观测性必须保留

旧 `base` 的初始化日志、旧 `interconnection` 的连接状态、上下游 dev 里形成的 selector/state 验证方法，都说明一件事：

这个仓库的 core 包不是“库代码”，而是要在真实宿主、真实双机、真实恢复场景里被反复联调的运行时系统。

重构后必须继承：

1. 启动阶段必须可观测。
2. request、session、dispatch、sync、projection 等关键阶段必须可观测。
3. 每个基础包都必须有可执行 dev 验证入口。

重构后必须超越：

1. `dev` 不能只做最小启动脚本，必须做语义断言。
2. 涉及持久化恢复时，必须默认走 `full / seed / verify`。
3. 涉及双机链路时，必须默认走真双进程验证，而不是单进程 mock。
4. 核心包自己的验证不能长期依赖下游包间接覆盖。

---

## 4. 必须明确不继承的旧实现方式

下面这些不是“亮点”，而是后续必须明确避免的旧实现方式：

1. 多个全局 manager 并列存在。
2. `storeEntry` 作为默认真相源入口。
3. `registerXxx` 最后写入者生效的全局 mutable slot。
4. `RootState`、`ModuleSliceConfig` 主要靠声明合并扩展。
5. transport 语义与业务完成语义混在一起。
6. request 真相依赖跨端 slice 合并。
7. 重要同步规则只存在于团队默契里。
8. 包本身没有足够强的 `dev` 验证体系。

这些点前面已经在重构总体设计中达成共识，这里再次列出，是为了防止后续实现阶段回退。

---

## 5. 新架构的继承与超越检查表

后续每设计一个新包或一个新协议，都至少要过一遍下面检查表。

### 5.1 统一语言

1. 是否继续使用统一上下文语言，而不是引入新的平行术语。
2. 上下文语义是否在 contracts 中显式公开。

### 5.2 统一运行时

1. 是否仍然通过统一 runtime 装配入口工作。
2. 是否避免重新引入多个全局 manager。

### 5.3 command 体系

1. 新能力是否仍围绕 command 与 runtime context 工作。
2. command lifecycle 是否有显式协议，不再靠旁路 listener 补写。
3. 跨包写是否严格走公开 command，而不是旁路 dispatch 对方 slice action。

### 5.4 ports 与宿主

1. 平台能力是否通过 runtime-scoped ports 注入。
2. 是否区分 dev fallback 与 production 强约束。

### 5.5 topology 与同步

1. 当前问题到底属于 topology control plane，还是普通 projection/state sync。
2. request 正确性是否已经脱离普通 slice 同步。
3. 同步 contract 是否显式，不再只靠 `updatedAt` 默契。
4. 所有时间字段是否都保持毫秒时间戳数字语义。

### 5.6 request 观测

1. request 真相是否由 owner-ledger 持有。
2. request projection 是否只是读模型。
3. accepted/completed 是否已经严格区分。

### 5.7 验证体系

1. 该包是否有自己的语义级 dev 验证。
2. 如涉及恢复，是否有真实重启验证。
3. 如涉及双机，是否有真实双进程验证。

### 5.8 包边界公开面

1. `state` 是否仍可被全局读取。
2. 包根公开面是否只暴露 contracts、selectors、commands、必要 supports。
3. `features/slices`、`features/actors` 是否仍保持包内实现属性。
4. 产品 runtime 四层是否统一使用同一套运行时 ID helper。
5. `0-mock-server` 是否只做协议兼容，而没有被错误纳入产品 runtime 的统一 ID 实现边界。

---

## 6. 对后续设计工作的直接要求

基于本文结论，后续 `1-kernel/1.1-base` 和 `0-mock-server/dual-topology-host` 的所有设计与实现，必须满足下面要求：

1. 不能因为旧实现有问题，就把旧架构最有价值的统一语言、统一运行时、command 主语、跨端 request 观测一起丢掉。
2. 不能因为追求边界清晰，就把业务包接入成本做得比旧架构更高。
3. 不能因为去全局化，就把上游 assembly/adapter 的总装配入口重新搞成分裂状态。
4. 不能因为要清理同步模型，就否定 timestamp-based 同步在 projection 场景里的实用价值。
5. 不能因为 request 真相回到 owner-ledger，就削弱 UI/task 对跨端 request 的统一观测能力。
6. 不能因为 host 只是开发宿主，就降低协议清晰度和可观测性标准。

换句话说：

新架构必须比旧架构更清晰、更显式、更可验证；同时必须继续保留旧架构最强的工程价值，即统一语言、统一 runtime、低接入成本和跨端协同能力。

---

## 7. 一句话结论

旧 `base` 和 `interconnection` 最值得继承的，不是它们的类名、目录和全局写法，而是它们已经替整个仓库验证过的四件事：

1. 统一 runtime 是对的。
2. command 作为系统主语是对的。
3. POS 多屏拓扑作为一等概念是对的。
4. 跨端 request 统一观测是必须的。

第一阶段重构必须做到：

把这四件事保留下来，并把它们从“大包 + 单例 + 隐式约定”升级成“分层清晰 + 协议公开 + runtime 实例化 + 验证完备”的新基础架构。
