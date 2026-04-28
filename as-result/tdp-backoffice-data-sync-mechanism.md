# TDP 与后台数据同步机制梳理

> 范围：本文基于 `1-kernel/1.1-base` 与 `1-kernel/1.2-business` 当前代码阅读整理，并补充少量 mock 后台与 mock terminal platform 的发布链路证据，用来解释“后台主数据如何进入终端、终端如何消费、同步范围如何界定”。

## 1. 总体结论

当前架构把终端数据同步拆成三层：

1. **TCP 控制面**：负责终端激活、凭证、`sandboxId`、`terminalId`、组织绑定信息。
2. **TDP 数据面**：负责和后端建立数据会话，维护通用 projection 仓库、cursor、水位、ACK/APPLIED 回执、topic 变化广播。
3. **业务主数据 read model**：`1.2-business` 下的业务包只消费 TDP 的 topic 变化，把通用 projection 解码成业务可读状态和 selector。

因此，后台数据同步不是业务包各自拉 HTTP 或 WebSocket；业务包也不直接知道后台 API。后台只把数据发布为 TDP projection，终端 TDP runtime 负责接收和归一化，业务包只订阅 `tdpTopicDataChanged`。

核心链路可以概括为：

```text
后台主数据文档变更
  -> projection_outbox
  -> mock-terminal-platform /api/v1/admin/tdp/projections/batch-upsert
  -> TDP projection + terminal change log
  -> WebSocket PROJECTION_CHANGED / PROJECTION_BATCH 或下次 snapshot/changes 补偿
  -> 终端 tdp-sync-runtime-v2 projection repository
  -> 按 scope 优先级计算“生效 projection”
  -> tdpTopicDataChanged 广播
  -> 1.2-business 主数据包 decode + upsert read model
  -> selector 给 UI / product shell 使用
```

## 2. 相关包职责

### 2.1 `tcp-control-runtime-v2`

路径：`1-kernel/1.1-base/tcp-control-runtime-v2`

职责是终端控制面，不承载业务主数据。

关键状态：

| slice | 语义 | 持久化 | 主副同步 |
| --- | --- | --- | --- |
| `identity` | 设备指纹、设备信息、`terminalId`、激活状态 | `owner-only` | `master-to-slave` |
| `credential` | `accessToken`、`refreshToken`、过期时间、凭证状态 | `owner-only`，token 走 protected storage | `master-to-slave` |
| `binding` | `platformId`、`projectId`、`tenantId`、`brandId`、`storeId`、`profileId`、`templateId` | `owner-only` | `master-to-slave` |
| `sandbox` | 当前 `sandboxId` | `owner-only` | `master-to-slave` |
| `runtime` | 启动观测、requestId、lastError | 不持久化 | 不同步 |

激活成功后，TCP 写入：

- `sandboxId`
- `terminalId`
- access token / refresh token
- 组织绑定：平台、项目、租户、品牌、门店等

这些信息是后续 TDP 连接和本地 scope 解析的基础。

### 2.2 `tdp-sync-runtime-v2`

路径：`1-kernel/1.1-base/tdp-sync-runtime-v2`

职责是通用数据面：

- TDP WebSocket 会话连接、断线重连、握手。
- HTTP snapshot / changes 补偿协议。
- 维护本地 projection retained-state 仓库。
- 维护 cursor、水位、ACK、applied cursor。
- 将服务端消息归一成 domain action。
- 按终端绑定信息计算当前生效 projection。
- 向业务包广播 `tdpTopicDataChanged`。
- 桥接系统 topic：error catalog、parameter catalog。
- 承载 hot-update desired projection、远程 command inbox、终端日志上传命令路由等通用能力。

重要状态：

| slice | 语义 | 持久化 | 主副同步 |
| --- | --- | --- | --- |
| `session` | 连接状态、sessionId、nodeState、syncMode、highWatermark | 不持久化 | 不同步 |
| `sync` | snapshot/changes 状态、lastCursor、lastAppliedCursor | `lastCursor` 和 `lastAppliedCursor` 持久化 | 不同步 |
| `projection` | 本地 retained projection 仓库 | record 级 `owner-only` | 不同步 |
| `commandInbox` | 后台下发命令收件箱 | 不持久化 | 不同步 |
| `controlSignals` | EDGE_DEGRADED、REHOME_REQUIRED、protocol error | 不持久化 | 不同步 |
| `hotUpdate` | 当前版本、desired、candidate、ready、restartIntent、history | `owner-only` | desired 走 `master-to-slave` |

### 2.3 `1.2-business` 主数据包

路径：`1-kernel/1.2-business`

当前三个业务主数据包：

| 包 | 依赖 | 业务定位 |
| --- | --- | --- |
| `organization-iam-master-data` | 必依赖 `tdp-sync-runtime-v2` | 组织、项目、租户、品牌、门店、合同、桌台、工作站、用户、角色、权限等 |
| `catering-product-master-data` | 必依赖 TDP，可选依赖组织 IAM | 餐饮商品、分类、菜单、价格、渠道映射 |
| `catering-store-operating-master-data` | 必依赖 TDP，可选依赖组织 IAM | 门店配置、售卖状态、库存/可售数量 |

业务包的统一模式：

```text
onCommand(tdpTopicDataChanged)
  -> 判断 topic 是否属于本包
  -> decode payload envelope
  -> upsertRecords({ records, changedAt })
  -> dispatch 本包 master-data-changed
```

业务包不维护 HTTP/WS/TDP client，也不直接读后台数据库。

## 3. 数据原理

### 3.1 后台事实源和终端 retained state

从业务语义上，后台主数据是 authoritative source。终端只维护本地 read model，用于离线可读、启动恢复、UI 展示和业务决策。

后台发布到 TDP 的最小事实单元是 projection：

```ts
{
  topic: string
  itemKey: string
  operation: 'upsert' | 'delete'
  scopeType: string
  scopeId: string
  revision: number
  payload: Record<string, unknown>
  occurredAt: string
  sourceReleaseId?: string | null
  scopeMetadata?: Record<string, unknown>
}
```

在 mock 后台主数据链路里，业务 payload 通常又包了一层业务 envelope：

```ts
{
  schema_version: 1,
  projection_kind: 'organization' | 'iam' | 'catering_product' | 'catering_store_operation',
  sandbox_id: string,
  platform_id: string,
  source_service: string,
  source_event_id: string,
  source_revision: number,
  generated_at: string,
  data: {...}
}
```

业务包 decode 的对象就是这个 envelope。TDP runtime 本身不理解里面的业务字段，只按 topic、scope、itemKey、revision 和 operation 管理通用 projection。

### 3.2 Projection retained state 与 change log 的关系

服务端 TDP 有两类数据：

- `tdp_projections`：当前 retained state，即某个 `topic + scopeType + scopeKey + itemKey` 的最新 projection。
- `tdp_change_logs`：按 terminal 产生的投递流水，带 cursor，用于 WebSocket 推送和 HTTP changes 补偿。

后台发布一条 projection 时：

1. 先写或删 `tdp_projections`。
2. 再根据 scope 找到目标终端，给每个终端生成 cursor。
3. 写入 `tdp_change_logs`。
4. 如果终端在线，则推送 `PROJECTION_CHANGED` 或 `PROJECTION_BATCH`。
5. 如果终端离线，则下次连接通过 snapshot 或 changes 补齐。

终端本地也有对应的两类状态：

- `tdpProjection`：本地 retained projection 仓库。
- `tdpSync.lastCursor / lastAppliedCursor`：本地已经接收/应用到哪里。

### 3.3 Cursor 与水位

服务端 cursor 是按终端维度增长的投递游标，不是业务 revision。

终端握手时会带 `lastCursor`：

- 没有 cursor 或本地 reset 后，服务端返回 `syncMode: 'full'`，随后发送 `FULL_SNAPSHOT`。
- 有 cursor 且服务端可增量补偿时，服务端返回 `syncMode: 'incremental'`，随后发送 `CHANGESET`。

终端应用成功后会发：

- `ACK`：确认收到指定 cursor。
- `STATE_REPORT`：报告 `lastAppliedCursor`。

服务端会用 ACK/APPLIED 计算 session lag，并更新命令、任务投递状态。

## 4. 终端逻辑顺序

### 4.1 启动阶段

终端 runtime 启动时，`runtime-shell-v2` 触发全局 initialize。TDP 的 initialize actor 会：

1. dispatch `bootstrapTdpSync`。
2. 如果 TCP 已是激活态且 `autoConnectOnActivation !== false`，dispatch `connectTdpSession`。

`bootstrapTdpSync` 会清理运行时态：

- session 回到初始连接态。
- snapshot/changes 状态回到 idle。
- lastDeliveredCursor、lastAckedCursor 清空。
- command inbox 清空。

但它不会清掉已经持久化的 `lastCursor`、`lastAppliedCursor` 和 projection 仓库；这些是重启恢复所需的事实。

### 4.2 激活阶段

终端通过 TCP command `activateTerminal` 激活：

1. 读取设备信息和 deviceFingerprint。
2. 调用 TCP HTTP service。
3. 成功后写入 `sandboxId`、`terminalId`、token、refreshToken、binding。
4. dispatch `activateTerminalSucceeded`。
5. TDP auto-connect actor 监听成功事件，自动 dispatch `connectTdpSession`。

这里有一个关键约束：TDP 必须依赖 TCP 已写入的 `sandboxId + terminalId + accessToken`。如果缺失，`connectTdpSession` 会失败，`bootstrapTdpSync` 也会在已有凭证但缺 `sandboxId` 时失败，避免跨 sandbox 串数据。

### 4.3 建连与握手

`connectTdpSession` 由 `TdpSessionConnectionActor` 转给 connection runtime：

1. 检查 socket 是否已经 connected/connecting。
2. 从 TCP selector 取 `sandboxId`、`terminalId`、`accessToken`。
3. 连接 `/api/v1/tdp/ws/connect?sandboxId=...&terminalId=...&token=...`。
4. socket connect resolve 后发送 `HANDSHAKE`。
5. handshake 带上：
   - `sandboxId`
   - `terminalId`
   - `appVersion`
   - `protocolVersion`
   - `lastCursor`
   - runtime identity：`localNodeId`、displayIndex、displayCount、MASTER/SLAVE、PRIMARY/SECONDARY

服务端返回：

1. `SESSION_READY`：包含 sessionId、nodeId、highWatermark、syncMode。
2. 如果 full，则返回 `FULL_SNAPSHOT`。
3. 如果 incremental，则返回 `CHANGESET`。

### 4.4 接收 snapshot / changes / 实时推送

服务端消息先进入 `tdpMessageReceived`，再按类型分派：

| 服务端消息 | 内部 command | 本地处理 |
| --- | --- | --- |
| `SESSION_READY` | `tdpSessionReady` | session 置 READY，记录 highWatermark 和 syncMode |
| `FULL_SNAPSHOT` | `tdpSnapshotLoaded` | 替换本地 projection 仓库，cursor 置 highWatermark |
| `CHANGESET` | `tdpChangesLoaded` | 批量应用 changes，cursor 置 nextCursor |
| `PROJECTION_CHANGED` | `tdpProjectionReceived` | 应用单条 change |
| `PROJECTION_BATCH` | `tdpProjectionBatchReceived` | 批量应用 change |
| `COMMAND_DELIVERED` | `tdpCommandDelivered` | 写 command inbox，并自动 ACK |
| `EDGE_DEGRADED` | `tdpEdgeDegraded` | session 进入 DEGRADED |
| `SESSION_REHOME_REQUIRED` | `tdpSessionRehomeRequired` | session 进入 REHOME_REQUIRED |
| `ERROR` | `tdpProtocolFailed` | 记录协议错误；TOKEN_EXPIRED/INVALID_TOKEN 会触发 TCP refresh |

Projection repository actor 应用数据后，都会 dispatch `recomputeResolvedTopicChanges`。

### 4.5 生效 projection 计算

TDP 本地保存的是“全量 retained projection”，但对业务包广播的是“生效后的 topic 变化”。

生效优先级来自 `selectTdpResolvedProjectionByTopic`：

```text
PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> GROUP -> TERMINAL
```

选择规则：

1. 先用 TCP binding 生成当前终端的 scope chain。
2. 如果有 `terminal.group.membership`，把 GROUP 插到 STORE 和 TERMINAL 之间，按 rank 排序。
3. 对同一 `topic + itemKey`，后面的更具体 scope 覆盖前面的 scope。
4. 业务包收到的是覆盖后的变化，不需要自己理解平台/项目/品牌/门店/终端覆盖规则。

例如：

- STORE 下发 `workflow.definition:wf-a = store`
- TERMINAL 下发同 itemKey `workflow.definition:wf-a = terminal`
- 业务侧看到的是 TERMINAL 版本
- 如果 TERMINAL tombstone 删除，业务侧会重新看到 STORE 版本

### 4.6 业务 read model 更新

`tdpTopicDataChanged` 被所有业务主数据包监听。每个包只处理自己的 topic：

1. 不属于本包 topic：返回 `{accepted: false}`。
2. 属于本包 topic：逐条 decode。
3. decode 成功：写入 `byTopic[topic][itemKey]`。
4. decode 失败：写 diagnostics，最多保留 50 条。
5. 写入后发本包 `master-data-changed`，供 UI 或其他观察者订阅。

业务 read model 的 slice 都是：

- `persistIntent: 'owner-only'`
- `syncIntent: 'master-to-slave'`
- `byTopic / diagnostics / lastChangedAt` 立即持久化
- 主副同步时走 record 级 tombstone 删除

也就是说：主屏/owner 负责持久化业务 read model，副屏可通过 state sync 获得业务主数据，不需要副屏自己连 TDP 重建同一份业务状态。

### 4.7 取消激活 / 重绑

取消激活或 reset 时：

1. TCP 清空 activation、credential、binding、sandbox。
2. TDP auto-connect actor 主动断开 TDP session。
3. TDP tcp reset actor 清空：
   - session
   - sync runtime 状态
   - projection repository
   - command inbox
   - protocol/control signal
   - `lastCursor`、`lastAppliedCursor`
4. 业务主数据包监听 `resetTcpControl`，清空本包 read model。

这个设计避免重新激活到不同 sandbox、不同门店、不同终端身份后复用旧 projection 或旧业务主数据。

## 5. 后台发布链路

### 5.1 mock admin mall tenant console

后台主数据服务维护 `master_data_documents`。变更时：

1. `sourceRevision + 1`。
2. 更新 envelope 的：
   - `source_service`
   - `source_event_id`
   - `source_revision`
   - `generated_at`
   - `data`
3. 根据 `domain:entityType` 映射成 TDP topic。
4. enqueue 到 `projection_outbox`。

当前映射包括：

| 后台 domain/entityType | TDP topic |
| --- | --- |
| `organization:platform` | `org.platform.profile` |
| `organization:project` | `org.project.profile` |
| `organization:tenant` | `org.tenant.profile` |
| `organization:brand` | `org.brand.profile` |
| `organization:store` | `org.store.profile` |
| `organization:contract` | `org.contract.active` |
| `iam:role` | `iam.role.catalog` |
| `iam:permission` | `iam.permission.catalog` |
| `iam:user` | `iam.user.store-effective` |
| `iam:user_role_binding` | `iam.user-role-binding.store-effective` |
| `catering-product:product` | `catering.product.profile` |
| `catering-product:brand_menu` | `catering.brand-menu.profile` |
| `catering-product:menu_catalog` | `menu.catalog` |
| `catering-store-operating:menu_availability` | `menu.availability` |
| `catering-store-operating:saleable_stock` | `catering.saleable-stock.profile` |

注意：这只是当前后台 mock 已实现的映射，不等于终端业务包支持范围的全集。终端业务包支持的 topic 更多，见第 6 节。

### 5.2 projection outbox 发布

后台 projection service 会：

1. 读取 `PENDING` outbox。
2. 按 `sandboxId` 分组。
3. 确保目标 TDP sandbox 存在。
4. POST 到：

```text
/api/v1/admin/tdp/projections/batch-upsert
```

请求 projection 形状：

```ts
{
  operation,
  topicKey,
  scopeType,
  scopeKey,
  itemKey,
  sourceEventId,
  sourceRevision,
  sourceReleaseId,
  occurredAt,
  scopeMetadata,
  payload,
  targetTerminalIds?
}
```

发布成功状态包括：

- `ACCEPTED`
- `IDEMPOTENT_REPLAY`

失败会标记 outbox 为 `FAILED`，自动发布器可重试。

### 5.3 mock terminal platform 接收发布

mock-terminal-platform 的 batch-upsert 做几件事：

1. 校验 admin token 与 `sandboxId`。
2. 拒绝不允许进入终端的 projection 分类字段和 secret 级 payload。
3. 使用 `sourceEventId` 做幂等判断。
4. 使用 `sourceRevision` 防止旧事件覆盖新事件。
5. 写 retained projection：
   - upsert：插入或更新 `tdp_projections`
   - delete：删除 retained projection
6. 按 scope 解析目标终端：
   - `TERMINAL`：目标就是 scopeKey。
   - `STORE`：所有 storeId 匹配的终端。
   - `TENANT`：所有 tenantId 匹配的终端。
   - `BRAND`：所有 brandId 匹配的终端。
   - `PROJECT`：所有 projectId 匹配的终端。
   - `PLATFORM`：所有 platformId 匹配的终端。
   - 显式 `targetTerminalIds` 存在时按显式目标投递。
7. 为每个目标终端写 `tdp_change_logs` cursor。
8. 在线终端收到 `PROJECTION_CHANGED` 或 `PROJECTION_BATCH`。

## 6. 数据同步范围

### 6.1 TDP 通用范围

TDP runtime 本身不限制业务 topic，它会保存任何服务端投递的 projection，并按 topic 广播变化。

但有几类通用 topic 被 base runtime 内置消费：

| topic | 消费方 | 作用 |
| --- | --- | --- |
| `error.message` | system catalog bridge | 远端错误文案 catalog |
| `system.parameter` | system catalog bridge | 远端系统参数 catalog |
| `terminal.hot-update.desired` | hot update reducer | 热更新目标版本 |
| `terminal.group.membership` | group selector / hot update reconcile | 终端动态分组 |
| `remote.control` / `print.command` | command inbox / ack / router | 远程命令通道 |
| `tcp.task.release` | TCP/TDP task projection | 非 remote-control 任务投递 |

### 6.2 组织与 IAM 主数据范围

包：`organization-iam-master-data`

支持 topic：

| topic | 类型 |
| --- | --- |
| `org.platform.profile` | organization |
| `org.region.profile` | organization |
| `org.project.profile` | organization |
| `org.tenant.profile` | organization |
| `org.brand.profile` | organization |
| `org.store.profile` | organization |
| `org.contract.active` | organization |
| `org.business-entity.profile` | organization |
| `org.table.profile` | organization |
| `org.workstation.profile` | organization |
| `iam.identity-provider.catalog` | iam |
| `iam.role.catalog` | iam |
| `iam.permission.catalog` | iam |
| `iam.permission-group.catalog` | iam |
| `iam.role-template.catalog` | iam |
| `iam.feature-point.catalog` | iam |
| `iam.platform-feature-switch.catalog` | iam |
| `iam.user.store-effective` | iam |
| `iam.user-role-binding.store-effective` | iam |
| `iam.resource-tag.catalog` | iam |
| `iam.principal-group.catalog` | iam |
| `iam.group-member.catalog` | iam |
| `iam.group-role-binding.store-effective` | iam |
| `iam.authorization-session.active` | iam |
| `iam.sod-rule.catalog` | iam |
| `iam.high-risk-policy.catalog` | iam |

主要 selector：

- 当前 platform/project/region/tenant/brand/store/contract。
- 当前门店用户、桌台、工作站。
- 当前租户 business entities。
- 门店有效角色、权限、用户角色绑定。
- IAM policy catalog。
- IAM readiness summary。
- Organization tree。

### 6.3 餐饮商品主数据范围

包：`catering-product-master-data`

支持 topic：

| topic | 语义 |
| --- | --- |
| `catering.product-category.profile` | 商品分类 |
| `catering.product.profile` | 商品 |
| `catering.product-inheritance.profile` | 商品继承/门店覆盖 |
| `catering.brand-menu.profile` | 品牌菜单 |
| `menu.catalog` | 终端菜单目录 |
| `catering.price-rule.profile` | 价格规则 |
| `catering.bundle-price-rule.profile` | 套餐价格规则 |
| `catering.channel-product-mapping.profile` | 渠道商品映射 |

主要 selector：

- 商品、分类、继承、菜单、渠道映射列表。
- 当前门店有效菜单。
- 菜单 section 下商品视图。
- 指定商品价格规则。
- 商品展示模型：商品卡、价格、类别、生产配置、菜单使用次数。

### 6.4 餐饮门店经营主数据范围

包：`catering-store-operating-master-data`

支持 topic：

| topic | 语义 |
| --- | --- |
| `store.config` | 门店经营配置 |
| `menu.availability` | 菜单/商品可售状态 |
| `catering.availability-rule.profile` | 可售规则 |
| `catering.saleable-stock.profile` | 可售库存 |

主要 selector：

- 当前门店配置。
- 当前门店菜单可售状态。
- 当前门店库存。
- 门店经营状态汇总：可售、售罄、低库存、预留库存。
- 运营看板模型。

## 7. 删除、tombstone 与重建语义

### 7.1 TDP 仓库层

TDP projection envelope 有 `operation: 'delete'`。终端本地 projection repository 收到 delete 后，会删除对应 retained projection：

```text
projectionId = topic:scopeType:scopeId:itemKey
```

这意味着 TDP 仓库只保留“当前还存在”的 retained state。

### 7.2 生效变化层

虽然 TDP retained 仓库删除了终端级 projection，但生效结果可能不是“没有数据”，而是退回更上层 scope 的 projection。

例子：

```text
STORE wf-a = A
TERMINAL wf-a = B
delete TERMINAL wf-a
```

业务包收到的变化不是简单 delete，而可能是 `upsert A`，因为当前生效值从 TERMINAL B 回退到 STORE A。

只有当所有匹配 scope 都没有该 itemKey 时，topicChangePublisher 才会广播 delete。

### 7.3 业务 read model 层

业务包 decoder 对 delete 会生成带 `tombstone: true` 的业务 record。slice 的 record sync 支持 tombstone：

- 本地 `upsertRecords` 会保留 tombstone record。
- selector 默认过滤 `record.tombstone`。
- 主副 state sync 收到 authoritative tombstone 时会从 `byTopic` 删除对应 record。

这解决了副屏或重启后旧业务主数据被 owner-only 持久化重新带回的问题。

### 7.4 重建命令

每个业务主数据包都有 `rebuild-master-data-from-tdp`：

- 从当前 TDP projection repository 按本包 topic 全量扫描。
- 按 revision 排序 decode。
- 替换本包 `byTopic`。
- 发 `master-data-changed`，topic 为 `*`。

`tdpSnapshotLoaded` 也会触发业务包重建，因此 full snapshot 后业务 read model 会对齐 TDP 仓库。

## 8. 主副屏 / 多实例同步关系

### 8.1 哪些东西走主副同步

TCP 激活态和业务 read model 走 `master-to-slave`：

- TCP identity / credential / binding / sandbox。
- 业务主数据 `byTopic`、diagnostics、lastChangedAt。
- hot-update desired。

这保证副屏能读到主屏已激活身份和业务数据。

### 8.2 哪些东西不走主副同步

TDP 的底层会话与 projection 仓库是 `isolated`：

- TDP session 状态不主副同步。
- TDP sync cursor 不主副同步。
- TDP projection repository 不主副同步。
- command inbox 不主副同步。

原因是这些属于连接与投递事实，必须由 owner/runtime 自己负责，不能简单复制另一个实例的 socket 会话状态。

业务层拿到的是已经加工后的 read model，适合给 UI 和副屏同步。

## 9. 错误、补偿与恢复

### 9.1 凭证错误恢复

TDP 收到 `ERROR` 且 code 是：

- `TOKEN_EXPIRED`
- `INVALID_TOKEN`

会：

1. disconnect 当前 TDP session。
2. 如果 TCP refreshToken 存在且当前不是 REFRESHING，dispatch `refreshCredential`。
3. TCP 刷新 token 后，后续可重新连接 TDP。

### 9.2 断线重连

TDP connection runtime 使用 socket lifecycle controller。重连次数和间隔来自：

- module input
- runtime parameter catalog
- PROD 默认无限重连
- DEV 默认参数

断线会更新 session status 和 disconnect reason。

### 9.3 重启恢复

TDP 持久化：

- `lastCursor`
- `lastAppliedCursor`
- projection entries

重启后：

1. runtime hydrate 这些状态。
2. 如果 TCP 仍是激活态，auto-connect。
3. 握手带 `lastCursor`。
4. 服务端返回 incremental changes。
5. 本地 projection repository 从旧 retained state 继续向前应用。

测试里已经覆盖：第一次运行收到 projection 并 flush persistence，第二次 runtime start 先恢复旧 projection，再连接并收到更新后的 incremental changes。

### 9.4 reset/rebind 恢复

`resetTcpControl` 是身份切换边界，不能沿用旧 cursor 和 projection。当前实现会清空 TDP projection、cursor 和业务 read model，下一次激活强制重新 full snapshot。

## 10. 与后台数据同步有关的边界判断

### 10.1 什么属于后台主数据同步

属于：

- 组织/IAM：平台、项目、租户、品牌、门店、合同、用户、角色、权限等。
- 餐饮商品：商品、菜单、分类、价格、渠道映射。
- 门店经营：门店配置、可售、库存。
- 系统 catalog：错误文案、系统参数。
- hot-update desired：终端期望版本。

这些都可以被建模成 retained projection，并通过 topic + scope + itemKey 下发。

### 10.2 什么不应该放进这套主数据 read model

不应该：

- 业务包自己发 HTTP/WS 请求同步后台。
- assembly 写业务主数据转换逻辑。
- UI 直接消费 TDP projection 仓库绕过业务 selector。
- 把 request/transport 成功当成业务数据已生效。
- 用 UI 过滤代替 tombstone/delete 语义。

### 10.3 scope 设计建议

当前 scope 会影响投递目标和本地覆盖优先级：

| scopeType | 适合数据 |
| --- | --- |
| `PLATFORM` | 平台级参数、全局权限/功能点 |
| `PROJECT` | 项目/购物中心级配置 |
| `BRAND` | 品牌菜单、品牌商品、品牌权限模板 |
| `TENANT` | 租户主体、租户经营实体 |
| `STORE` | 门店配置、桌台、工作站、库存、售卖状态 |
| `GROUP` | 动态分组策略、灰度配置 |
| `TERMINAL` | 终端专属配置、任务、hot update 精准投放 |

同一 itemKey 在更具体 scope 会覆盖更上层 scope。设计 itemKey 时要避免无意覆盖。

## 11. 当前验证证据

代码中已有这些验证面：

1. `tdp-sync-runtime-v2` 单测覆盖：
   - initialize 自动 bootstrap。
   - handshake 在 socket connect 后发送。
   - 激活后 auto connect。
   - runtime start 后凭持久化激活态 auto reconnect。
   - scope priority 与 GROUP 覆盖。
   - system catalog bridge。
   - projection repository 持久化与恢复。
   - cursor ACK / STATE_REPORT。
   - reset 后清 cursor 和 retained projection。
   - token expired / invalid token 触发 TCP refresh。
2. `tdp-sync-runtime-v2` live 测试覆盖：
   - mock-terminal-platform WebSocket 建连、握手、投影实时更新。
   - 真实重启后从持久化 cursor 和 projection repository 恢复，并以 incremental mode 追增量。
3. 三个业务主数据包测试覆盖：
   - authoritative tombstone 到达时，主副 state sync 会删除旧 record。
4. mock-terminal-platform 测试覆盖：
   - batch-upsert 幂等。
   - snapshot / changes 可查。
   - metadata 保留。
   - admin token 校验。
   - dynamic group materialization 与 terminal snapshot。

## 12. 仍需注意的风险点

1. **后台已实现 topic 映射不是终端支持全集**  
   例如终端组织 IAM 包支持 region、business-entity、table、workstation、permission-group 等，但当前 mock admin master-data service 的映射表只覆盖其中一部分。

2. **业务 decoder 是 envelope 强校验**  
   `schema_version`、`projection_kind`、`data` 不符合时，不会进 read model，只会进入 diagnostics。后台 envelope 格式变化必须同步更新 decoder。

3. **TDP projection delete 与业务 tombstone 是两层语义**  
   TDP 仓库 delete 会删除 retained projection；业务层是否收到 delete 取决于“生效 projection”是否真的消失。如果删除低优先级 projection 被高优先级 projection 覆盖，业务层可能看不到变化。

4. **cursor 是终端维度，不是全局 revision**  
   后台 `source_revision`、TDP `revision`、终端 `cursor` 是三个不同概念，排查时不要混用。

5. **主副同步的事实源分层要保持清楚**  
   副屏读业务 read model 没问题，但不能把副屏复制来的 TDP session/cursor 当成连接事实。当前代码已将 TDP session/projection 设为 isolated。

6. **reset 是身份边界**  
   重新绑定 sandbox/store/terminal 时必须清 cursor、projection 和业务 read model；当前 `resetTcpControl` 已覆盖这条语义，后续不要把它改成只断开连接。

## 13. 排查索引

| 问题 | 首先看哪里 |
| --- | --- |
| 终端没有连上 TDP | `tcp-control-runtime-v2` 的 `sandboxId / terminalId / accessToken`，再看 `tdp-sync-runtime-v2` session status |
| WebSocket 握手失败 | mock-terminal-platform `/api/v1/tdp/ws/connect`，检查 query token 和 `HANDSHAKE` payload |
| 后台改了数据终端没变 | 后台 `projection_outbox` 状态、mock-terminal-platform `tdp_change_logs`、终端 `tdpProjection` |
| 终端有 projection 但 UI 没变 | 是否属于业务包 topic、decoder diagnostics、业务 `byTopic`、selector 是否按当前 TCP binding 过滤 |
| 删除后旧数据又出现 | 是否只是删除了低优先级 scope；是否 business slice tombstone/state sync 生效；是否 reset 清理了 owner-only 持久化 |
| 重启后没有增量 | `lastCursor` 是否持久化，握手是否带 lastCursor，服务端是否返回 `syncMode: incremental` |
| 副屏数据不一致 | 业务 master-data slice 的 `master-to-slave` sync；不要查 TDP projection isolated state |

## 14. 一句话模型

后台负责产生 authoritative projection，TDP 负责把 projection 按 sandbox、terminal、scope、cursor 投递和恢复，终端业务包负责把“当前生效 topic 变化”解码成本地 read model。TCP 决定“我是谁、属于哪里”，TDP 决定“我拿到哪些数据、到哪个 cursor”，业务 selector 决定“当前界面该读哪部分数据”。
