# 2026-04-14 kernel-base v2 基础层缺口审计

## 1. 文档目标

在旧 `tcp-control-runtime` 与 `tdp-sync-runtime` 已完成退役后，当前阶段最重要的问题不再是“还能不能继续删旧包”，而是：

1. 对照旧 `_old_/1-kernel/1.1-cores/base`
2. 对照旧 `_old_/1-kernel/1.1-cores/interconnection`
3. 对照旧 `_old_/1-kernel/1.1-cores/communication`
4. 明确现有 `1-kernel/1.1-base/*` v2 基座还缺哪些基础能力
5. 并判断这些缺口会不会阻碍后续旧 core 和业务模块迁移

本文只做基础层缺口审计，不启动业务模块迁移。

---

## 2. 当前已成立的基础结论

截至本轮，下面事实已经成立：

1. 旧 `1-kernel/1.1-base/tcp-control-runtime`
2. 旧 `1-kernel/1.1-base/tdp-sync-runtime`
3. 旧 `1-kernel/1.1-base/runtime-shell`
4. 旧 `1-kernel/1.1-base/topology-runtime`
5. 旧 `1-kernel/1.1-base/topology-client-runtime`
6. 旧 `1-kernel/1.1-base/workflow-runtime`

都已经退役。

当前 `1-kernel/1.1-base` 活跃核心包为：

1. `contracts`
2. `definition-registry`
3. `platform-ports`
4. `state-runtime`
5. `transport-runtime`
6. `runtime-shell-v2`
7. `tcp-control-runtime-v2`
8. `tdp-sync-runtime-v2`
9. `workflow-runtime-v2`
10. `topology-runtime-v2`

并且已通过的关键验证包括：

1. `tcp-control-runtime-v2` live / restart
2. `tdp-sync-runtime-v2` live / reconnect / restart / command / system catalog
3. `runtime-shell-v2` request ledger / broadcast actor / command 聚合
4. `topology-runtime-v2` dual-topology-host 真连接 / request mirror / state sync / reconnect-resume
5. `workflow-runtime-v2` queue / observable / dynamic definitions

所以当前问题不是“v2 能不能跑”，而是“迁旧 core 和业务包时，是否还有基础表达层缺口”。

---

## 3. 对照旧 core 后，当前已经补齐的关键继承点

### 3.1 来自旧 base 的已继承能力

当前已确认继承到位的点：

1. `moduleName` 仍然保留，并继续作为包级命名空间基础。
2. `hooks/index.ts` 仍保留统一出口，但 kernel 包自身不依赖 React。
3. `Command` 仍然是跨包正式写接口。
4. `Actor` 仍然是 command 执行者，并且支持 actor 内继续派发 command。
5. request 生命周期真相源已经从旧 state 投影切到内存 `RequestLedger`。
6. errorMessages / systemParameters 已有定义、catalog、持久化与运行时更新通路。
7. 时间存储统一使用 long，日志/展示统一走时间格式化。
8. runtime id / request id / command id 已有统一生成能力。

### 3.2 来自旧 interconnection 的已继承能力

当前已确认继承到位的点：

1. `instanceMode / displayMode / workspace / standalone / enableSlave / masterInfo`
   1. 已重新落到 `topology-runtime-v2` 的 context / recovery / selector 模型。
2. 主副机双向 command 路由
   1. 已由 `runtime-shell-v2 + topology-runtime-v2` 联合承载。
3. request 跨节点镜像与聚合观测
   1. 已由 mirrored command + remote event + lifecycle snapshot 承载。
4. 状态同步
   1. 已由 `state-runtime + topology-runtime-v2` 承载。
5. 断线重连后不是盲目 flush，而是 resume + continuous sync
   1. 已通过真实 `dual-topology-host` 场景验证。

### 3.3 来自旧 communication 的已继承能力

当前已确认继承到位的点：

1. HTTP endpoint 声明式建模
2. HTTP runtime
3. service-first HTTP module helper
4. socket profile 声明式建模
5. socket runtime
6. transport error 统一归一化
7. transport 默认参数定义

也就是说，当前最底层的通信抽象并没有缺位。

---

## 4. 当前真正还剩的基础层缺口

### 4.1 `runtime-shell-v2` 仍未正式提供 request projection read model

当前现状：

1. `RequestLedger` 已经是 request 真相源。
2. `queryRequest(requestId)` 已可读取真实 request 状态。
3. 但 `createKernelRuntimeV2.ts` 中：
   1. `applyProjectionMirror(...)` 仍是空实现注释
   2. `getRequestProjection(...)` 当前直接返回 `undefined`

这说明：

1. 新 runtime 已有 request 真相源
2. 但还没有形成一个正式、可复用的 request projection read model 公开面

影响判断：

1. 这不会阻塞 `tcp-control-runtime-v2` / `tdp-sync-runtime-v2` 本身运行。
2. 但会影响后续业务模块如果想沿用旧“统一 request 查询视图”习惯时的心智一致性。

结论：

1. 这是一个真实缺口。
2. 优先级中等。
3. 建议在继续迁旧 core 之前先收口清楚：
   1. 是完全不再需要 projection read model
   2. 还是要给一个基于 ledger 的正式 selector/query helper

### 4.2 `transport-runtime` 的 WS 能力仍是“基础 transport”，还不是“旧 communication 完整成熟度”

对照旧 `communication` 当前还能看到的差距：

1. 没有 request queue / 限流能力。
2. 没有 interceptor 体系。
3. 没有 envelope 自动解包策略体系。
4. 没有更成熟的 metrics 聚合面。
5. socket runtime 仍偏底层 transport，不是高层 session orchestration 完整入口。

但是这里要区分：

1. 对当前 kernel base 迁移是否必要
2. 对后续业务模块使用是否必要

当前判断：

1. `tcp-control-runtime-v2` 和 `tdp-sync-runtime-v2` 已经把它们真正需要的连接编排自行承担了。
2. 所以后续如果只是继续迁旧 core，`transport-runtime` 目前不必为了追平旧 `communication` 而过度扩建。
3. 但如果后续要迁更多业务 HTTP/WS service 包，`transport-runtime` 需要继续补：
   1. 更轻量的 service helper
   2. 更稳定的 envelope helper
   3. 可选的 execution policy 扩展

结论：

1. 这是“后续增强项”，不是当前阻塞项。
2. 原则上应继续保持克制，不要先把 `transport-runtime` 重做成第二个大包。

### 4.3 `topology-runtime-v2` 的稳定 selector 面已经存在，但业务迁移样板仍偏测试驱动

当前已有：

1. `selectTopologyContext`
2. `selectTopologyWorkspace`
3. `selectTopologyDisplayMode`
4. `selectTopologyInstanceMode`
5. `selectTopologyScopedStateKey`
6. `selectTopologyRequestProjection`

但当前业务式样板主要还体现在测试 helper 中，而不是正式文档化的业务接入模板。

这意味着：

1. 能力已在
2. 但开发者使用路径还没有完全沉淀成“稳定、直觉”的规范

结论：

1. 这更像文档与接入范式缺口，不是能力缺口。
2. 优先级低于 request projection read model 与剩余 core 能力迁移。

### 4.4 旧 `base / interconnection` 的一些高频 helper 已有替代能力，但还缺“正式迁移规则文档”

当前已经有替代实现：

1. `createModuleStateKeys`
2. scoped slice helper
3. topology selectors
4. error / parameter factory
5. HTTP endpoint/service helper

但还缺一份明确映射：

1. 旧 helper 是什么
2. 新 helper 是什么
3. 哪些理念保留
4. 哪些旧用法应禁止回流

这会影响后续迁移时的一致性判断。

结论：

1. 这是规范缺口，不是运行时缺口。
2. 但重要性高，因为后续会直接影响业务模块迁移质量。

---

## 5. 对“是否会阻碍后续迁移”的判断

### 5.1 不会阻碍的部分

当前明确不会阻碍继续迁旧 core 的能力：

1. TCP 控制面
2. TDP 数据面
3. workflow queue / observation / dynamic definition
4. topology command 路由
5. topology state sync
6. topology reconnect / resume
7. errorMessages / systemParameters catalog

### 5.2 会影响迁移质量、但不是立即阻塞的部分

1. request projection 正式公开面还没彻底定型。
2. transport-runtime 对旧 communication 的“高层成熟易用度”还没完全追平。
3. 旧 helper -> 新 helper 的正式迁移映射规则还不够集中。

---

## 6. 下一步建议

当前建议顺序如下：

1. 先不回头再处理已删除的旧包。
2. 先补齐 `runtime-shell-v2` 关于 request observation / projection 的正式公开约定。
3. 再补一份“旧 core helper -> 新 base helper”的正式迁移映射规则文档。
4. 然后继续对照旧 `_old_/1-kernel/1.1-cores/base / interconnection / communication` 的具体业务特性，逐项验证 v2 基座是否已具备承接能力。
5. 只有在这一步收口后，再进入旧 core 剩余能力或业务模块迁移。

---

## 7. 本轮结论

本轮结论很明确：

1. 用户本轮指定优先清理的两个旧包：
   1. `1-kernel/1.1-base/tcp-control-runtime`
   2. `1-kernel/1.1-base/tdp-sync-runtime`
   已经退役完成。
2. 当前的主问题已经从“删旧包”切换成“补齐 v2 基础层剩余表达能力与迁移规范”。
3. 真正值得优先补的，不是再删目录，也不是提前迁业务包，而是：
   1. request observation/projection 正式公开面
   2. 旧 helper 到新 helper 的迁移规则收口
   3. transport-runtime 继续保持克制，只补对业务迁移真正有价值的易用层
