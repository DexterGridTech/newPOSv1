# TDP Dynamic Group / Projection Policy Design

## Background

当前 `0-mock-server/mock-terminal-platform` 的 TDP 投递模型，本质上是“在服务端写 projection 时，根据当下主数据解析目标终端集合，再把变更写成 terminal-level change log”。

这套模型适合一次性投递，但不适合持续生效的策略：

1. 当一个新终端在策略发布后加入某个项目/门店/机型范围时，它不会自动获得之前已经发布的策略。
2. 热更新、运行时配置、workflow 定义、调试开关等策略，都需要“持续命中”，而不是“发布瞬间命中”。
3. 当前终端侧已经具备基于 scope 优先级解析 `resolved projection` 的能力，因此没必要额外造一套完全独立的终端本地策略引擎。

本设计的目标不是只解决热更新，而是为 TDP 增加一个通用的 Dynamic Group / Projection Policy 能力层，让所有“持续生效”的 projection 型策略都可以建立在其上。

## Verified Current State

以下现状已通过源码核实：

1. 服务端当前按 `scopeType/scopeKey` 在写入时展开目标终端集合，逻辑位于 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts:146`。
2. 终端 snapshot / changes 依赖 `tdp_change_logs.target_terminal_id` 反查，不会在连接时重新按 selector 求值，逻辑位于 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts:523` 与 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts:129`。
3. 终端侧 `tdp-sync-runtime-v2` 已经实现 scope-based resolved projection，优先级链为 `PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> TERMINAL`，逻辑位于 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/tdpSync.ts:22`。
4. 终端侧不会直接把 raw projection 暴露给业务，而是先生成 `tdpTopicDataChanged` 的最终生效变化，逻辑位于 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/topicChangePublisher.ts:94`。
5. `workflow-runtime-v2` 已经复用该机制消费远端 workflow 定义，位于 `1-kernel/1.1-base/workflow-runtime-v2/src/features/actors/workflowRemoteDefinitionActor.ts:12`。
6. 新 Android assembly 已有 `assemblyAppId / assemblyVersion / bundleVersion / runtimeVersion / protocolVersion / capabilities` 等运行时字段，位于 `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts:52`。
7. 主副机兼容层已使用 `runtimeVersion` 做兼容判断，逻辑位于 `1-kernel/1.1-base/host-runtime/src/foundations/compatibility.ts:41`。

结论：

1. 当前模型不能承载“新终端自动补命中”。
2. 终端侧已经具备 resolved projection 能力，适合扩展而不是推倒重做。
3. Dynamic Group 更适合作为 TDP 的基础控制能力，而不只是热更新的专用补丁。

## Goals

1. 为 TDP 增加动态 group / selector 能力，支持持续生效的 projection 型策略。
2. 让新终端在加入某个策略范围后，自动获得当前应生效的策略，而无需人工重发。
3. 复用终端现有 `resolved projection` 能力，而不是新增另一套本地求值引擎。
4. 支持在管理后台维护 selector group、查看 membership、维护 group-level policy、查看终端最终命中结果。
5. 让热更新、运行时参数、workflow 定义等都能建立在同一机制上。

## Non-goals

1. 第一版不处理 `remote.control` / `print.command` 这类即时命令。
2. 第一版不在终端本地执行 selector 匹配计算；终端只消费服务端已经计算好的 membership 结果。
3. 第一版不支持脚本型 matcher，不支持任意 JS 表达式。
4. 第一版不改造 TDP 传输协议的消息大类，仍沿用 `FULL_SNAPSHOT / CHANGESET / PROJECTION_CHANGED / PROJECTION_BATCH`。
5. 第一版不实现热更新业务本身，只提供它所依赖的 Dynamic Group / Projection Policy 基础层设计。

## Design Principles

1. **Selector 在服务端求值。** 终端不负责解释 selector，只负责消费 membership 和 projection。
2. **Resolved projection 继续在终端完成。** 服务端负责算 membership，终端负责基于 scope 链算最终真相。
3. **Group 是 scope，不是独立引擎。** 不引入与 `PLATFORM/PROJECT/.../TERMINAL` 并行的第二套优先级语义，而是把 `GROUP` 纳入现有 scope 体系。
4. **Membership 是可观测事实。** group 命中结果需要能被后台与终端共同观察，而不只是服务端内部计算细节。
5. **Projection policy 是持续性策略。** 只有“应持续存在并可被后续新终端继承”的策略进入该系统。
6. **优先级应稳定且可解释。** 冲突规则必须可回溯、可排序、可审计。

## High-Level Architecture

系统拆成四层：

1. **Selector Group Layer**
   - 定义“哪些终端属于这个 group”。
   - group 可以表达业务范围、设备范围、运行时范围、能力范围的组合条件。

2. **Membership Materialization Layer**
   - 当终端激活、版本变化、主数据变化、group 变化时，重算 terminal 与 group 的 membership。
   - membership 是可持久化、可审计、可下发的事实。

3. **Projection Policy Layer**
   - 某个 topic 的某个 itemKey 的策略，可以绑定到 `PLATFORM/PROJECT/BRAND/TENANT/STORE/GROUP/TERMINAL` 任意 scope。
   - group-level 策略本质上仍是 projection，只是 scopeType 变成 `GROUP`。

4. **Terminal Resolution Layer**
   - 终端收到所有相关 projection 后，复用现有 `resolved projection` 逻辑，按 scope priority 决出最终真相。
   - 业务包只消费 `tdpTopicDataChanged`，继续保持“只关注生效变化”的编程模型。

## Scope Model Extension

当前终端的 scope priority 是：

`PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> TERMINAL`

第一版扩展为：

`PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> GROUP(ordered...) -> TERMINAL`

其中：

1. `GROUP` 不是单个 bucket，而是一个按顺序展开的 scope 片段列表。
2. 多个 group 的顺序由服务端先算好，终端只消费一个排序后的 `groupIds[]`。
3. 在终端解析中，越靠后的 scope 优先级越高，继续复用现有 resolved projection 代码路径。
4. `GROUP` 是一个“横切策略覆盖带”，不是天然比 `STORE` 更具体的业务层级。

这样可以保证：

1. 平台/项目/门店的默认策略依旧有效。
2. 更精细的 group 策略可以覆盖 store 级默认值。
3. terminal 级局部修正仍然拥有最高优先级。

该位置是刻意选择，不是根据 selector 宽窄自动推断：

1. 如果某策略不应覆盖门店默认值，第一版不应发布为 `GROUP` scope，而应继续使用 `PROJECT / STORE` 等原有 scope。
2. 如果某策略需要跨项目、跨门店覆盖一批终端，例如 hotfix、灰度、运行时禁用开关，则适合发布为 `GROUP` scope。
3. 第一版不支持“group 插入任意 scope 位置”，避免终端解析链变成不可解释的动态优先级系统。
4. 后台必须通过 impact preview 明确提示 `GROUP` policy 将覆盖哪些 lower scope 候选值。

## Selector Group Model

### `selector_groups`

建议新增实体：

- `groupId`
- `sandboxId`
- `groupCode`
- `name`
- `description`
- `enabled`
- `priority`
- `selectorDslJson`
- `membershipVersion`
- `createdAt`
- `updatedAt`

设计说明：

1. `priority` 表示 group 在同层 group 之间的默认优先级。
2. `membershipVersion` 每次 selector 变化或批量重算后递增，用于观测 membership 刷新轮次。
3. 第一版的 `selectorDslJson` 采用结构化 matcher，不支持脚本。

### Selector DSL v1

第一版建议结构如下：

```json
{
  "match": {
    "platformId": ["platform_mixc"],
    "projectId": ["project_sz_bay_mixc"],
    "tenantId": ["tenant_mc_sz"],
    "brandId": ["brand_mc"],
    "storeId": ["store_1001"],
    "profileId": ["profile_android_pos"],
    "templateId": ["template_android_pos_standard"],
    "assemblyAppId": ["assembly-android-mixc-retail-rn84"],
    "runtimeVersion": ["android-mixc-retail-rn84@1.0"],
    "assemblyVersion": ["1.0.0"],
    "bundleVersion": ["1.0.0+ota.0"],
    "protocolVersion": ["2026.04"],
    "devicePlatform": ["android"],
    "deviceModel": ["Mixc Retail Android RN84"],
    "deviceOsVersion": ["Android 14"],
    "capabilitiesAll": ["projection-mirror", "state-sync"]
  }
}
```

规则：

1. 同一字段内数组表示 OR。
2. 不同字段之间表示 AND。
3. `capabilitiesAll` 表示必须全部包含。
4. 第一版刻意不支持 `capabilitiesAny`，也不支持 not / range / regex / script。

该 matcher 思路与 `WorkflowPlatformMatcher` 保持一致，只是扩展到主数据字段与 assembly 字段，参考 `1-kernel/1.1-base/workflow-runtime-v2/src/types/definition.ts:13`。

## Membership Model

### `selector_group_memberships`

建议新增实体：

- `membershipId`
- `sandboxId`
- `groupId`
- `terminalId`
- `rank`
- `matchedByJson`
- `membershipVersion`
- `computedAt`
- `updatedAt`

说明：

1. `rank` 是服务端最终排序后的组内顺位，供终端直接展开 scope chain。
2. `matchedByJson` 记录关键命中理由，用于后台 explain 和排障。
3. `membershipVersion` 与 group 的当前版本保持一致，方便检查终端是否拿到了最新 membership。
4. `sandboxId` 是强隔离边界；group、membership、terminal 都必须位于同一个 sandbox，跨 sandbox 不共享、不匹配。

### Membership Projection

为了让终端和后台都可观测，建议引入一个系统 topic：

`terminal.group.membership`

该 topic 对每个 terminal 只维护一个 item，例如：

```json
{
  "membershipVersion": 12,
  "groups": [
    {
      "groupId": "group-project-pos-rn84",
      "priority": 100,
      "rank": 0,
      "matchedBy": {
        "projectId": "project_sz_bay_mixc",
        "profileId": "profile_android_pos",
        "runtimeVersion": "android-mixc-retail-rn84@1.0"
      }
    },
    {
      "groupId": "group-hotfix-gray-10",
      "priority": 200,
      "rank": 1,
      "matchedBy": {
        "projectId": "project_sz_bay_mixc",
        "templateId": "template_android_pos_standard"
      }
    }
  ]
}
```

终端用途：

1. 构造 `GROUP` 片段的 scope chain。
2. 做日志、诊断、调试展示。

后台用途：

1. 看每台终端属于哪些 group。
2. 看为什么命中。
3. 诊断优先级冲突。

### Sandbox Isolation

第一版沿用 mock-platform 现有 sandbox 模型，语义如下：

1. `selector_groups`、`selector_group_memberships`、`projection_policies` 都是 sandbox 内部对象。
2. terminal 只能命中同 sandbox 内的 group。
3. policy 只能物化到同 sandbox 内的 projection / change log。
4. 切换当前 sandbox 只影响当前运营视角，不会跨 sandbox 共享 membership 计算结果。

## Projection Policy Model

### `projection_policies`

建议引入实体：

- `policyId`
- `sandboxId`
- `topicKey`
- `itemKey`
- `scopeType`
- `scopeKey`
- `enabled`
- `payloadJson`
- `description`
- `createdAt`
- `updatedAt`

说明：

1. `scopeType` 第一版支持：
   - `PLATFORM`
   - `PROJECT`
   - `BRAND`
   - `TENANT`
   - `STORE`
   - `GROUP`
   - `TERMINAL`
2. `scopeKey` 在 `GROUP` 场景下就是 `groupId`。
3. `itemKey` 延续当前 TDP projection item 语义，用于同一 topic 下的多对象覆盖。
4. 第一版不设置 `projection_policies.priority`，避免与 `selector_groups.priority` 语义重叠；同一 scope bucket 不允许并存多个 enabled policy，因此 policy 本身不需要再参与排序。

### Field Naming Contract

当前服务端存储层使用 `scopeKey`，TDP 传输 envelope 使用 `scopeId`。第一版统一约定：

1. 控制面对象（policy、后台 API、数据库）继续使用 `scopeType + scopeKey`。
2. 数据面 envelope 继续使用 `scopeType + scopeId`。
3. 两者在语义上是一一映射关系：`scopeId = scopeKey`。
4. `GROUP` scope 下，`scopeKey / scopeId` 都等于 `groupId`。

### 为什么 policy 单独成表，而不是直接写 `tdp_projections`

原因：

1. `tdp_projections` 是当前某个 scope 的生效快照，不适合作为策略编辑真相源。
2. policy 需要启停、描述、审计、冲突分析、后台编辑；这些都属于控制面对象。
3. `tdp_projections` / `tdp_change_logs` 更适合作为“从 policy 物化出来的数据面结果”。

### Policy Materialization Contract

`projection_policies` 是控制面真相源；`tdp_projections` 与 `tdp_change_logs` 是物化后的数据面结果。第一版物化约定如下：

1. policy 的 `create / update / enable / disable / delete` 都会同步触发一次物化。
2. 物化目标是：
   - upsert 或 delete 对应的 `tdp_projections`
   - 为所有受影响 terminal 追加 `tdp_change_logs`
3. 对于 `GROUP` scope policy：
   - `tdp_projections` 中保留一条 `scopeType=GROUP, scopeKey=groupId` 的记录
   - change log 仍按 terminal fan-out 写入，复用现有终端消费模型
4. 第一版采用单进程同步物化：
   - 请求返回成功，表示控制面保存与数据面物化都已成功
   - 任一步骤失败，整个操作回滚，不允许出现“policy 已保存但 projection 未更新”的中间态
5. 幂等键为 `topicKey + itemKey + scopeType + scopeKey`；同 bucket 的 enabled policy 只能有一条
6. 后续如果 terminal 规模增长，可把物化改成异步 job，但控制面 contract 不变

## Conflict Resolution

### Between different outer scopes

固定优先级：

`PLATFORM < PROJECT < BRAND < TENANT < STORE < GROUP(rank ascending) < TERMINAL`

越靠后优先级越高。

### Between multiple groups

多个 groups 的相对顺序由服务端先算好，再写入 membership：

1. `group.priority` 低的在前，高的在后。
2. `priority` 相同，则 `updatedAt` 新的在后。
3. 仍相同，则 `groupId` 字典序兜底。

终端不重新比较 `group.priority`，只按照 membership 给出的顺序插入 scope chain。

### Between policies within same exact scope bucket

同一 `topic + itemKey + scopeType + scopeKey` 在同一时刻只应有一个 enabled policy 作为控制面约束。

如果后台仍允许多条存在，则服务端保存前必须判冲突，并要求：

1. 要么编辑已有 policy
2. 要么显式停用旧 policy
3. 不允许依赖终端侧在同 scope bucket 内做二次竞态求值

## Service-Side Materialization Flow

### Recompute triggers

以下事件都应触发 membership 或 policy 物化刷新：

1. terminal 激活成功
2. terminal runtime 信息上报变化
3. store / project / tenant / brand / profile / template 等主数据归属变化
4. selector group 新增 / 编辑 / 启停 / 删除
5. projection policy 新增 / 编辑 / 启停 / 删除

### Recompute pipeline

推荐服务端流程：

1. 读取目标 terminal 的主数据与运行时画像
2. 计算匹配到的 groups
3. 按规则排序并更新 `selector_group_memberships`
4. 为 terminal upsert `terminal.group.membership` projection
5. 将所有 `GROUP` scope policy 继续保持为 group-level projection
6. TDP 终端在收到 membership 更新后，后续 resolved projection 自然会切换到新的 group 策略

### Membership Delivery Semantics

membership 不是“下次重连才看见”的离线数据，而是和其他 projection 一样参与当前 TDP 推送链路：

1. terminal 在线时：
   - membership projection upsert 后，服务端立即写 `tdp_change_logs`
   - 复用现有 `PROJECTION_CHANGED / PROJECTION_BATCH` 在线推送机制
   - 终端在收到变更后重算 resolved projection
2. terminal 离线时：
   - change log 会在下次连接时通过 `FULL_SNAPSHOT` 或 `CHANGESET` 补齐
3. 第一版不额外定义 membership 专用消息类型，也不引入单独通知通道
4. 第一版实时性目标是“同一进程内完成物化后立刻入现有推送队列”，而不是额外承诺跨节点毫秒级 SLA

### Group Lifecycle And Cleanup

group 生命周期变化必须反映到 membership 与终端最终真相：

1. group `disable`：
   - 不再参与后续 membership 匹配
   - 已有 `selector_group_memberships` 记录在本轮重算后删除或标记失效
   - `terminal.group.membership` topic 会被重写，终端收到后从 scope chain 中移除该 group
2. group `delete`：
   - 先停用，再清理 memberships，再删除控制面记录
   - 若仍有 `GROUP` scope policy 绑定该 group，删除前必须阻止或要求先清理 policy
3. group selector `update`：
   - 触发目标 sandbox 范围内的 membership 重算
   - 旧 membership 以新一轮结果为准，不保留“幽灵 group”

### Recompute Concurrency Contract

第一版虽然采用同步重算，但仍要明确并发保护规则：

1. 同一 terminal 的 membership 重算必须串行提交。
2. `membershipVersion` 的递增与 membership 结果写入应当在同一事务内完成。
3. 终端只认最新 `membershipVersion` 对应的结果，不依赖中间态。
4. 如果同一 terminal 在短时间内因多个事件反复触发重算，允许合并为最后一轮结果，但不得出现版本倒退。

### Why not materialize final terminal projection on server

不推荐把 group policy 全部预先摊平成 terminal-level final projection，原因：

1. 终端已有 resolved projection 机制，重复建设没有必要。
2. 终端本来就能消费多层 projection，再摊平会丢失“来自哪个 scope”的可观察性。
3. workflow definition、system.parameter 等已经依赖该机制，复用成本最低。

## Terminal-Side Changes

### `tdp-sync-runtime-v2`

终端侧只需要做两类扩展：

1. 扩展 `buildScopePriorityChain(state)`
   - 从 `terminal.group.membership` topic 的 resolved result 中读取 `groups[]`
   - 按 `rank` 顺序插入：`GROUP:groupId`
2. 补 selector / topic 读取辅助函数
   - 如 `selectTerminalGroupMembership(state)`

### No protocol rewrite

`TdpProjectionEnvelope` 现有结构已经足够：

- `topic`
- `itemKey`
- `scopeType`
- `scopeId`
- `revision`
- `payload`

第一版只需要让 `scopeType=GROUP` 成为合法值，无需新增消息类别，类型入口位于 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/state.ts:14`。

## Mock Terminal Platform Backend Changes

### Database

新增：

1. `selector_groups`
2. `selector_group_memberships`
3. `projection_policies`

可选新增：

4. `terminal_runtime_facts`
   - 如果不想把运行时画像直接塞在 `terminal_instances`，可单独抽表保存最新上报事实

### Terminal Runtime Facts Contract

selector 能正确命中的前提，是服务端掌握终端当前运行时事实。第一版约定如下：

1. facts 来源分两类：
   - 激活期事实：来自 `/api/v1/terminals/activate` 的 `deviceInfo`
   - 会话期事实：来自 TDP `HANDSHAKE` / 后续可扩展的状态上报
2. 当前代码已具备部分事实来源：
   - `activateTerminal` 已保存 `deviceInfoJson`
   - TDP `HANDSHAKE` 已上报 `appVersion / protocolVersion / capabilities`
   - assembly 已能提供 `assemblyAppId / bundleVersion / runtimeVersion / protocolVersion / capabilities`
3. 第一版建议补齐一条统一的 runtime facts upsert 逻辑：
   - terminal 首次 connect 时写入当前会话事实
   - 会话重连且事实变化时覆盖更新
4. 用于 selector 的关键字段至少包括：
   - `assemblyAppId`
   - `assemblyVersion` 或 `appVersion`
   - `bundleVersion`
   - `runtimeVersion`
   - `protocolVersion`
   - `capabilities`
5. runtime facts 更新后必须触发 membership 重算

### API

新增建议接口。

#### Core CRUD / Query APIs

1. `GET /api/v1/admin/tdp/groups`
2. `POST /api/v1/admin/tdp/groups`
3. `PUT /api/v1/admin/tdp/groups/:groupId`
4. `DELETE /api/v1/admin/tdp/groups/:groupId`
5. `POST /api/v1/admin/tdp/groups/:groupId/recompute`
6. `GET /api/v1/admin/tdp/groups/:groupId/memberships`
7. `GET /api/v1/admin/tdp/terminals/:terminalId/memberships`
8. `GET /api/v1/admin/tdp/policies`
9. `POST /api/v1/admin/tdp/policies`
10. `PUT /api/v1/admin/tdp/policies/:policyId`
11. `DELETE /api/v1/admin/tdp/policies/:policyId`
12. `GET /api/v1/admin/tdp/terminals/:terminalId/resolved-topics`
13. `GET /api/v1/admin/tdp/terminals/:terminalId/decision-trace`

#### Admin UI Support APIs

为了支撑“可预览、可解释、可排障”的后台体验，第一版建议同时补齐以下接口：

14. `GET /api/v1/admin/tdp/policy-center/overview`
15. `POST /api/v1/admin/tdp/groups/preview`
16. `GET /api/v1/admin/tdp/groups/:groupId/stats`
17. `GET /api/v1/admin/tdp/groups/:groupId/policies`
18. `POST /api/v1/admin/tdp/policies/validate`
19. `POST /api/v1/admin/tdp/policies/preview-impact`
20. `GET /api/v1/admin/tdp/policies/:policyId`
21. `GET /api/v1/admin/tdp/terminals/:terminalId/topics/:topicKey/decision`
22. `POST /api/v1/admin/tdp/groups/recompute-all`
23. `POST /api/v1/admin/tdp/groups/recompute-by-scope`

说明：

1. `groups/preview` 用于 selector 编辑时实时预览命中终端，不落库。
2. `policies/validate` 用于保存前校验同 scope bucket 冲突。
3. `policies/preview-impact` 用于展示“启用该 policy 后，哪些 terminal 的最终真相会变化”。
4. `terminals/:terminalId/topics/:topicKey/decision` 返回单 topic 的 candidate chain + winner explanation，比整个 `decision-trace` 更适合后台按 topic 调试。
5. `groups/recompute-all` 用于全 sandbox 重算。
6. `groups/recompute-by-scope` 用于按 `PROJECT / STORE / TERMINAL` 等范围重算，适合主数据批量迁移后使用。
7. mock-platform 第一版可以全部同步执行，不必引入独立 job queue；若后续 terminal 数量扩大，再演进为异步重算任务。

#### Decision Trace Response Shape

`GET /api/v1/admin/tdp/terminals/:terminalId/decision-trace` 至少返回：

```json
{
  "terminalId": "terminal_001",
  "runtimeFacts": {
    "assemblyAppId": "assembly-android-mixc-retail-rn84",
    "bundleVersion": "1.0.0+ota.0",
    "runtimeVersion": "android-mixc-retail-rn84@1.0",
    "protocolVersion": "2026.04",
    "capabilities": ["projection-mirror", "state-sync"]
  },
  "membershipSnapshot": {
    "membershipVersion": 12,
    "groups": [
      {
        "groupId": "group-hotfix-gray-10",
        "priority": 200,
        "rank": 1,
        "matchedBy": {
          "projectId": "project_sz_bay_mixc",
          "runtimeVersion": "android-mixc-retail-rn84@1.0"
        }
      }
    ]
  },
  "perTopicCandidates": [
    {
      "topicKey": "terminal.runtime.config",
      "itemKey": "default",
      "candidates": [
        {
          "scopeType": "STORE",
          "scopeKey": "store_1001",
          "revision": 3,
          "source": "projection",
          "payload": {"mode": "store-default"}
        },
        {
          "scopeType": "GROUP",
          "scopeKey": "group-hotfix-gray-10",
          "policyId": "policy_hotfix_001",
          "revision": 1,
          "source": "policy",
          "payload": {"mode": "hotfix"}
        }
      ],
      "winner": {
        "scopeType": "GROUP",
        "scopeKey": "group-hotfix-gray-10",
        "reason": "GROUP rank 1 overrides STORE"
      }
    }
  ],
  "resolvedResults": {
    "terminal.runtime.config": {
      "default": {"mode": "hotfix"}
    }
  }
}
```

### Audit

需要追加审计事件：

1. `CREATE_SELECTOR_GROUP`
2. `UPDATE_SELECTOR_GROUP`
3. `DELETE_SELECTOR_GROUP`
4. `RECOMPUTE_SELECTOR_GROUP`
5. `CREATE_PROJECTION_POLICY`
6. `UPDATE_PROJECTION_POLICY`
7. `DELETE_PROJECTION_POLICY`
8. `RECOMPUTE_TERMINAL_MEMBERSHIP`

## Mock Terminal Platform Admin UI

### New Information Architecture

当前后台已有：

1. TCP 控制台
2. TDP 会话 / Topic / Projection / ChangeLog
3. 基础资料中心

第一版 Dynamic Group 设计建议新增一个新的一级区块：

`TDP 策略中心`

在产品层面，它是新的一级导航；在技术实现层面，建议继续复用当前 `0-mock-server/mock-terminal-platform/web/src/App.tsx` 的单页 section 模式，不额外引入 router 或第二套页面框架。

建议左侧导航扩展为：

1. `策略总览`
2. `Group 管理`
3. `策略管理`
4. `终端决策`

其中：

1. `Group 详情`、`Policy 编辑` 采用抽屉 / 面板 / 内嵌详情区实现，不强制新增独立路由。
2. 全局 `Audit Log` 仍复用现有后台能力，但每个页面都需要提供 deep-link 或筛选入口。
3. `TDP 数据面` 页面继续保留，负责查看原始 topic/projection/change log；`TDP 策略中心` 负责查看控制面对象和最终解释结果。

### 1. 策略总览页

这是 `TDP 策略中心` 的 landing page，用于回答四个问题：

1. 当前一共有多少 groups / policies 在生效。
2. 最近有没有 membership 重算异常或冲突。
3. 哪些 terminal 当前 membership 过期或缺少运行时事实。
4. 最近哪些策略变更可能影响线上终端。

建议模块：

1. 统计卡片
   - Enabled Groups
   - Enabled Policies
   - Membership Stale Terminals
   - 最近 24h 重算次数
2. 最近变更
   - 最近更新的 groups
   - 最近更新的 policies
3. 风险提示
   - selector 无命中 group
   - policy 冲突待处理
   - terminal 缺少 runtimeVersion / assemblyAppId 等关键事实
4. 快捷入口
   - 新建 group
   - 新建 policy
   - 全量重算 membership
   - 跳转 terminal decision trace

### 2. Group 管理页

该页负责管理 selector group 的定义和生命周期。

#### 列表字段

字段：

- Group 名称
- 编码
- 是否启用
- Priority
- Selector 摘要
- Membership 数量
- 最近计算时间

操作：

- 新建 group
- 编辑 group
- 启停 group
- 删除 group
- 手动重算 membership
- 查看成员

#### 建议筛选器

- 启用状态
- project / tenant / brand / store
- assemblyAppId
- runtimeVersion
- 有无挂载 policy
- membership 是否 stale

#### 新建 / 编辑 Group 交互

建议采用右侧抽屉或分步表单，分为三段：

1. 基础信息
   - name / code / description / enabled / priority
2. Selector 编辑器
   - 结构化表单优先，JSON 编辑器作为高级模式
   - 字段枚举来自现有 master-data + terminal runtime facts
3. 命中预览
   - 预估命中终端数
   - 按 project / store / runtimeVersion / assemblyAppId 聚合分布
   - 示例 terminal 列表

保存规则：

1. 保存前先调 `POST /groups/preview`。
2. 若命中数为 0，允许保存，但给出显著 warning。
3. 若 selector 过宽，命中终端数超过阈值，应提示用户确认。

### 3. Group 详情页

Group 详情页建议采用四个 tab：

1. `定义`
2. `Members`
3. `Policies`
4. `Audit`

内容：

1. Selector DSL JSON
2. 命中摘要统计
   - 命中终端数
   - 按项目分布
   - 按机型分布
   - 按 runtimeVersion 分布
3. Membership 明细
   - terminalId
   - project/store/profile/template
   - matchedBy
   - rank
   - computedAt
4. 关联策略
   - 该 group 上挂了哪些 projection policies

补充要求：

1. `定义` tab 要展示 selector 的 explain 文本，而不仅是 JSON。
2. `Members` tab 要支持跳转到 terminal decision view。
3. `Policies` tab 要支持直接新建一个 `scopeType=GROUP` 的 policy，并自动带入当前 `groupId`。
4. `Audit` tab 默认按当前 `groupId` 过滤现有 audit log。

### 4. 策略管理页

该页负责管理 `projection_policies` 这个控制面真相源，而不是直接编辑 `tdp_projections`。

#### 列表字段

字段：

- topicKey
- itemKey
- scopeType
- scopeKey
- enabled
- payload 摘要
- updatedAt

操作：

- 新建 policy
- 编辑 policy
- 启停 policy
- 删除 policy
- 跳到关联 group / terminal / store / project

#### 建议筛选器

- topicKey
- scopeType
- scopeKey
- enabled
- runtimeVersion 标签
- 最近变更时间

#### 新建 / 编辑 Policy 交互

建议采用“表单 + 即时校验 + 影响预览”的三段式：

1. 选择 topic / itemKey / scopeType / scopeKey
2. 编辑 payloadJson 与 description
3. 做两类校验
   - 冲突校验：同 bucket 是否已有 enabled policy
   - 影响预览：哪些 terminal 的最终 resolved result 会变化

策略保存规则：

1. 默认不允许同 `topic + itemKey + scopeType + scopeKey` 并存多个 enabled policy。
2. 若用户编辑的是 disabled policy，可先保存草稿，再手动启用。
3. 启用动作前必须明确展示 impact preview，尤其是 `GROUP` scope。

### 5. Policy 详情视图

为了减少列表页过重，建议提供内嵌详情面板，展示：

1. 基础属性
2. payload JSON
3. 命中的 terminal 数量
4. 最近一次 impact preview 结果
5. 最近变更审计记录
6. 关联对象跳转
   - group
   - terminal
   - topic raw projection

### 6. 终端决策视图

这是第一版最重要的后台页面，用于解释“为什么这个终端当前拿到的是这个最终真相”。

建议展示：

1. 终端基础事实
   - terminalId
   - project / store / profile / template
   - assemblyAppId / assemblyVersion / bundleVersion / runtimeVersion / protocolVersion
2. 当前 membership
   - 排序后的 groups
   - 每个 group 的 matchedBy
3. 某个 topic 的候选 projection 链
   - platform candidate
   - project candidate
   - store candidate
   - group candidate(s)
   - terminal candidate
4. 最终 resolved result
5. 胜出原因
   - “store default 被 group hotfix 覆盖”
   - “group gray-10 被 terminal override 覆盖”

这页是后续热更新、配置治理、workflow 远端定义联调时的核心排障入口。

补充交互建议：

1. 顶部先按 `terminalId` 检索，命中后再按 `topicKey` 过滤。
2. `topicKey` 维度默认展示“最终值已变化的 topic”，避免信息过载。
3. 对每个 candidate scope 展示：
   - scopeType / scopeKey
   - policyId 或 projection 来源
   - revision
   - payload 摘要
4. 支持一键跳转到：
   - 对应 group
   - 对应 policy
   - 原始 TDP projection / change log 页面

### 7. 页面间主流程

为了让后台不是“只会 CRUD”，第一版要把以下三个核心流程串起来：

#### 流程 A：创建一个新的动态组

1. 在 `策略总览` 或 `Group 管理` 点击新建
2. 填基础信息
3. 配 selector
4. 做 preview
5. 保存
6. 自动进入 Group 详情页查看 membership

#### 流程 B：给某个 group 发布一个 projection policy

1. 从 Group 详情 `Policies` tab 点击新建 policy
2. 自动带入 `scopeType=GROUP` 与 `scopeKey=groupId`
3. 编辑 topic / itemKey / payload
4. 运行 conflict validate
5. 运行 impact preview
6. 确认启用
7. 跳转到 terminal decision view 验证最终真相

#### 流程 C：排查“某台终端为什么没拿到预期配置”

1. 在 `终端决策视图` 搜 terminalId
2. 看 runtime facts 是否完整
3. 看 membership 是否包含预期 group
4. 看 candidate chain 是否存在预期 policy
5. 看 winner 是否被更高 scope 覆盖
6. 必要时跳转回 group / policy / raw TDP 页面继续排查

### 8. 页面状态与异常标记

为了保证后台可运营，页面上至少要统一支持以下 badge / 状态：

1. `disabled`
2. `stale-membership`
3. `no-members`
4. `conflict`
5. `missing-runtime-facts`
6. `impact-large`

语义：

1. `stale-membership`：terminal facts 或 group 变更后尚未完成重算。
2. `conflict`：同 scope bucket 存在违规多启用 policy，或 selector/group 排序出现不可解释状态。
3. `impact-large`：即将影响终端数超过配置阈值，需要用户再次确认。

### 9. 与现有后台模块的边界

避免职责混乱，第一版边界如下：

1. `基础资料` 继续维护平台、项目、租户、品牌、门店、profile、template 等主数据。
2. `TDP 数据面` 继续展示原始 topics / projections / change logs / sessions。
3. `TDP 策略中心` 负责 groups / memberships / policies / resolved decision trace。
4. 如果用户在 `TDP 数据面` 手工 upsert projection，仍允许，但对 `GROUP` scope 显示“绕过 policy control plane”的风险提示。

## Compatibility With Future Hot Update

该 Dynamic Group 设计将直接成为热更新的基础能力层：

1. 热更新只需要新增 `topic = terminal.hot-update.desired`
2. 针对项目/机型/runtimeVersion 的灰度包，只需要创建对应 group
3. 对该 group 写入 `scopeType=GROUP` 的热更新 policy
4. 新终端上线后自动命中 membership，并在 resolved projection 中获得最终 desired hot update

这能避免“热更新自己实现一套 selector 与灰度系统”的重复建设。

## Testing Strategy

### Server

新增测试类型：

1. group selector 匹配测试
2. membership 排序测试
3. policy 冲突校验测试
4. terminal 激活后自动补命中 group 测试
5. 主数据变化后 membership 重算测试
6. group 停用后 resolved result 回退测试
7. policy → projection 同步物化测试
8. membershipVersion 并发安全测试

### Terminal

在 `tdp-sync-runtime-v2` 增加：

1. `GROUP` scope 插入优先级链测试
2. 多 group 排序覆盖测试
3. membership topic 变化触发 resolved topic 变化测试
4. workflow.definition 在 `GROUP` scope 下的远端定义覆盖测试
5. 在线收到 membership 推送后即时重算 resolved topic 测试

### Live end-to-end

建议补一个 mock-platform live 场景：

1. 创建 store default policy
2. 创建 group policy
3. 激活 terminal A，验证命中 group policy
4. 激活 terminal B，验证新终端无需重发也命中 group policy
5. 停用 group policy，验证回退到 store default
6. 在线终端不重连即可收到 membership 变化并完成切换

## Open Decisions

虽然主方向已经明确，仍有几个实现级决策需要在实现前拍板：

1. terminal runtime facts 是继续挂在 `terminal_instances`，还是单独建 `terminal_runtime_facts`。
2. `profileId / templateId` 是否被视为 selector DSL 的一等字段，还是只在 group 解释层使用。
3. 是否允许一个 terminal 属于大量 groups；第一版建议设置上限并在后台报错。
4. `GROUP` scope 是否允许用户在 Topic 管理页直接手工注入；第一版建议允许但带明显风险提示。
5. membership projection 是否只做 terminal scope，还是允许在后台按 group 聚合查询；建议 terminal scope 下发、后台另做聚合查询接口。

## Recommendation

建议按以下顺序推进：

1. 在 `mock-terminal-platform` 服务端新增 `selector_groups / selector_group_memberships / projection_policies`。
2. 新增后台“TDP 策略中心”页面，先把 group、membership、policy、terminal decision trace 做出来。
3. 在 `tdp-sync-runtime-v2` 中扩展 `GROUP` scope 与 membership 读取。
4. 用 `workflow.definition` 或 `system.parameter` 做第一批验证 topic，先证明 Dynamic Group 机制成立。
5. 等机制稳定后，再基于它设计热更新 topic 与业务状态机。

这条路径可以先把“持续命中 selector”能力打牢，再把热更新作为上层业务接入，避免热更新设计绑死在一次性的 terminal snapshot 投递模型上。
