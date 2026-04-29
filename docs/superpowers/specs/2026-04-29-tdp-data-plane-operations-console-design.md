# TDP 数据平面运维 Console 设计

日期：2026-04-29  
范围：`2-ui/2.1-base/admin-console`、`1-kernel/1.1-base/tdp-sync-runtime-v2`、`1-kernel/1.1-base/tcp-control-runtime-v2`、可选的 mock terminal platform TDP admin API

当前实现状态：

- Phase 1 已落地：admin console 增加 `TDP 数据平面` tab，终端本地会话、topic 协商、同步流水线、本地存储和事件告警可视化由 `selectTdpOperationsSnapshot` 聚合提供。
- Phase 2 已落地：`tdp-sync-runtime-v2` 增加 runtime-only `topic-activity` 状态，记录 snapshot/changes/realtime 的 topic 收到量、应用量、最近时间和近期频率，`persistIntent` 为 `never`。
- Phase 3 已落地到 server API、admin console host 边界和 Android host-runtime wiring：mock terminal platform 提供 `operations-snapshot` 聚合 API，admin console 通过可选 `AdminTdpHost` 手动刷新服务端视角，host-runtime-rn84 将该 host tool 注入真实终端 admin console。
- Review 增强已落地：服务端诊断刷新失败时保留同一终端上一份成功 snapshot，页面和诊断摘要明确标记 `serverDiagnostics: stale`；终端身份变化后不复用旧 server snapshot；服务端 `serverAvailableTopics` 采用“服务端定义/解析存在且通过 profile/template policy allowlist”的口径，避免把被策略拒绝的 topic 误判为可给。
- Android VM 已完成一次 server-enhanced 点击验证，主屏 admin console 可刷新出服务端 Profile、Template、session lag 和 topic 对比。真机仍建议在实际慢机环境中复跑一遍，用于区分 VM/设备性能差异。

## 1. 背景

终端 admin console 目前更偏“设备、拓扑、版本、控制、日志、适配器”查看，缺少一个专门排查 TDP 数据同步问题的入口。TDP 同步链路涉及终端身份、profile/template 策略、topic 订阅协商、快照/增量游标、本地 projection 存储、ACK/APPLY 反馈以及服务端会话状态。任何一段异常都会表现成“页面没有数据”“副屏/主屏状态不一致”“某类业务配置没有下发”“重启后恢复不对”等问题。

本设计新增一个业务无关的 **TDP 数据平面** 面板。它不是业务调试页，也不是原始 JSON dump，而是面向运维和研发排障的状态控制台：先判断问题在哪一段，再给出足够字段追到原因。

## 2. 设计目标

1. 让运维人员在终端本机快速回答：“这个 Terminal 是谁、绑定了哪个 profile/template、TDP 当前是否连上、同步卡在哪一步。”
2. 清晰对比 **本地想要的 topics**、**服务器能给的 topics**、**最终协商接受的 topics**，定位策略拒绝、服务端缺失、本地未订阅和 hash 不一致。完整三方对比依赖 Phase 3 的服务端增强诊断；Phase 1 先提供本地需求、协商结果和本地 projection 视角，并把服务端能力明确标记为未连接或未知。
3. 展示 topic 级同步规模、最近同步时间、频率、projection 本地条目、scope 分布和异常状态。
4. 展示本地恢复真相源和 projection 存储状态，支持判断重启恢复、游标复用、快照 apply 和本地缓存是否异常。
5. 保持 admin console 的 base UI 属性，不依赖业务包，不把业务 topic 知识写死在 UI 中。
6. 遵守分层：kernel 暴露 selector/state/command，UI 负责运维渲染，assembly 只负责 host wiring。

## 3. 非目标

1. 不在第一版提供业务数据编辑、业务配置修复或 projection 手工改写。
2. 不把服务端 admin API 当作面板的唯一数据来源；本机离线或服务端 admin API 不可达时，面板仍应展示 local-only 状态。
3. 不在 UI 中硬编码业务 topic 的业务含义。topic 分类只做协议/运维层级的弱分类，例如 projection、command、system、unknown。
4. 不把 runtime-only 指标持久化为恢复真相源。观测指标可以重启后归零。

## 4. 信息架构

在 admin console 的“运行管理”分组下新增 tab：

- Tab key：`tdp`
- 标题：`TDP 数据平面`
- 提示：`查看终端数据同步、Topic 协商、本地存储和服务端诊断`

进入后页面内部再使用横向子 Tab，避免单页过载：

1. `总览`
2. `Topic 对比`
3. `同步流水线`
4. `Topic 明细`
5. `本地存储`
6. `事件与告警`
7. `服务端诊断`

子 Tab 默认落在 `总览`。当检测到异常时，总览中的告警卡片可以跳转到对应子 Tab，例如 required topic missing 跳到 `Topic 对比`，snapshot applying 卡住跳到 `同步流水线`。

子 Tab 的职责边界：

- `Topic 对比` 聚焦 **订阅协商与策略差异**，只保留必要的数据规模提示。
- `Topic 明细` 聚焦 **数据规模、频率和本地 projection 活动**，不重复解释 profile/template 策略。
- `服务端诊断` 聚合服务端 session、decision trace 和 policy source，不替代本地状态页。

窄屏终端上仍保留横向子 Tab，但优先展示 `总览 / Topic 对比 / 同步流水线 / 本地存储`，其余子 Tab 可横向滚动进入。异常摘要必须能直接跳转，减少在窄屏上寻找入口的成本。

## 4.1 运行策略

### 权限

TDP 数据平面继承 admin console 现有管理员入口和密码校验。Phase 1 不新增角色体系；所有字段默认按“现场运维可看”设计。涉及服务端增强诊断、复制诊断摘要、projection 样本摘要时，默认不展示完整 payload，并对可能包含业务标识的字段做最小化展示。

未来如果 admin console 增加角色权限，可按能力拆分：

- 运维角色：可看状态、游标、topic 协商、同步规模。
- 研发角色：可复制诊断摘要、查看 decision trace、查看脱敏 projection 样本。
- 禁止项：任何角色都不能在此面板直接改写 projection 或业务数据。

### 刷新策略

本地状态页使用 Redux store subscription 实时刷新，刷新来源是 kernel state，不需要手动刷新按钮。服务端诊断页采用手动刷新为主，避免在 POS 终端上产生额外后台请求；后续可提供低频自动刷新开关，默认关闭。

复制诊断摘要时必须包含采样时间、local-only/server-enhanced 模式、当前子 Tab、terminalId、sandboxId 和 displayIndex，避免离线排障时误读数据来源。

### 多屏行为

面板展示 **当前屏幕所在 runtime/localNode 的 TDP 状态**。在双屏或多实例场景中，主屏和副屏各自打开 admin console 时，应分别看到自己的 `localNodeId / displayIndex / displayMode / instanceMode` 和本地 TDP 状态。服务端增强诊断可以额外列出同 terminal 下的其他在线 session，但不能把其他屏的状态混入当前屏总览卡片。

### 错误边界

如果 kernel 尚未初始化、某个 selector 不存在、host tool 不可用或服务端请求失败，面板显示分区级降级信息，不让整个 admin console 崩溃。降级信息需要说明是 `未初始化`、`未安装能力`、`服务端不可达` 还是 `读取失败`，并保留能读取到的其他本地状态。

## 5. 总览页

总览页服务于第一眼分诊，不展示过多列表。

### 5.1 顶部健康卡

| 卡片 | 字段来源 | 健康判断 |
| --- | --- | --- |
| 会话状态 | `selectTdpSessionState().status` | `READY` 为正常；`RECONNECTING/HANDSHAKING/DEGRADED` 为警告；`ERROR/DISCONNECTED/REHOME_REQUIRED` 为错误 |
| 同步模式 | `tdpSession.syncMode` | `incremental` 正常；`full` 说明正在全量恢复或游标不可复用 |
| 游标延迟 | `highWatermark - lastAppliedCursor` | 0 正常；持续大于 0 为警告；持续增长为错误 |
| Topic 健康 | requested/accepted/rejected/missing 汇总 | required missing 或 rejected 非空为警告/错误 |
| 本地存储 | `tdpSync` 恢复字段、`tdpProjection` 条目 | 游标缺失、快照未完成、projection 异常膨胀为警告 |
| 服务端视角 | 可选 server session | server 在线且与本地 session 匹配为正常；不匹配为警告 |

断连或重连状态下，`tdpSession.highWatermark` 可能是旧值。此时 `游标延迟` 卡片必须降级显示为 `基于断连前水位`，只展示数值和最后更新时间，不把 stale lag 直接判定为同步错误。只有在 `READY` 或服务端增强诊断能确认当前 high watermark 时，才把 lag 纳入健康判断。

### 5.2 Terminal Context

展示终端身份和拓扑上下文，帮助定位“看的是哪台机器、哪块屏、哪个模板”。

字段：

- `sandboxId`
- `terminalId`
- `profileId`
- `templateId`
- `platformId / projectId / brandId / tenantId / storeId`
- `localNodeId`
- `displayIndex / displayCount`
- `instanceMode / displayMode`
- `appVersion / protocolVersion`，如果 TDP session 或 runtime context 可提供

当前 `tcp-control-runtime-v2` 已有 `TcpBindingContext.profileId/templateId` 和 sandbox/terminal 信息；profile/template 的 code/name 如需展示，需要从服务端 runtime facts 或 terminal profile/template API 补充。

降级策略：

- Phase 1 只保证展示 `profileId/templateId`。
- 如果 code/name 不可用，显示 `未同步名称`，不要显示成 `未绑定`。
- 如果 id 也不存在，才显示 `未绑定`，并在问题摘要提示终端控制面绑定不完整。

### 5.3 问题摘要

总览底部展示 3 到 5 条最重要的诊断结果，不展示冗余成功项。

示例：

- `required topic terminal.group.membership 未被服务端接受，可能影响 group scope projection。`
- `lastAppliedCursor 落后 highWatermark 128 个 revision，最近 60 秒仍在增长。`
- `本地 projection 中存在 42 条当前订阅外 topic，可能是订阅切换后的残留缓存。`
- `服务端 acceptedTopics 与本地 lastAcceptedSubscribedTopics 不一致，建议检查 session 是否为旧连接。`

## 6. Topic 对比页

这是面板的核心排障页。它回答三个问题：

1. 本地 runtime 想订阅什么？
2. 服务端根据 topic registry、profile/template 策略、terminal facts 能给什么？
3. 握手后实际接受了什么？

### 6.1 对比模型

每个 topic 合并以下视角：

| 视角 | 含义 | 来源 |
| --- | --- | --- |
| 本地请求 | runtime descriptors 解析出的 subscribed topics | `resolveTdpSubscriptionFromDescriptors(context.descriptors)` 或 `tdpSync.lastRequestedSubscribedTopics` |
| 本地 required | 本地模块声明缺失会影响运行的 required topics | descriptors 解析结果，目前需要暴露到 selector 或 observability |
| 服务端可给 | 服务端 topic registry 或 terminal resolved topics 中存在，且通过当前 profile/template policy allowlist 的 topic | `operations-snapshot.subscription.serverAvailableTopics` |
| profile/template 允许 | profile/template allowlist 交集后的策略结果 | server `readTerminalTopicPolicy` / decision trace |
| 实际接受 | handshake accepted topics | `tdpSession.subscription.acceptedTopics`、`tdpSync.lastAcceptedSubscribedTopics` |
| 拒绝/缺失 | rejected / requiredMissing | `tdpSession.subscription.rejectedTopics`、`requiredMissingTopics` |
| 本地存在 | 本地 projection 是否已有该 topic 数据 | `selectTdpActiveProjectionEntriesByTopic` |

### 6.2 表格字段

| 列 | 显示 | Phase |
| --- | --- | --- |
| Topic | topic key，支持复制 | Phase 1 |
| 本地需求 | `required`、`requested`、`not requested`；required 若未暴露则显示 `requested` 或 `未暴露` | Phase 1 部分可用 |
| 服务端能力 | `available`、`policy denied`、`missing`、`unknown`；若服务端刷新失败但存在旧 snapshot，显示为基于旧 snapshot 的 `stale` 判断 | Phase 3 |
| 协商结果 | `accepted`、`rejected`、`required missing`、`inactive` | Phase 1 |
| 状态 | `正常`、`策略拒绝`、`服务端缺失`、`未订阅可用`、`本地残留`、`Hash 不一致`、`未知` | Phase 1 部分可用，完整状态需 Phase 3 |
| 本地条目 | active projection entry count；只作为规模提示，详细分析跳转到 Topic 明细 | Phase 1 |
| 最近 revision | topic 内最大 revision；只作为规模提示 | Phase 1 |
| 原因 | profile/template allowlist、invalid topic、required missing、server no projection 等 | Phase 1 显示 handshake 原因；Phase 3 显示服务端 policy 原因 |

`最近更新时间`、`同步频率`、scope 分布等数据活动字段放在 `Topic 明细` 页，避免 Topic 对比页同时承担策略排查和数据规模分析。

### 6.3 状态判定

| 状态 | 判定 |
| --- | --- |
| 正常 | 本地 requested/required，服务端 available，实际 accepted |
| 策略拒绝 | 本地 requested，但 profile/template allowlist 不允许，出现在 rejected；该 topic 不应出现在 `serverAvailableTopics` |
| 服务端缺失 | 本地 required/accepted，但 `serverAvailableTopics` 中不存在；原因可能是 registry 缺失、resolved projection 无数据或当前 policy 不允许 |
| 未订阅可用 | 服务端 available，但本地 descriptors 未请求 |
| 本地残留 | 当前未 accepted，但本地 projection 仍有 active entries |
| Hash 不一致 | 本地 requested hash、server accepted hash、lastAccepted hash 不一致 |
| 未知 | local-only 模式下没有服务端增强数据，无法判断服务端能力 |

Phase 1 下的 `Hash 不一致` 只比较本地 `lastRequestedSubscriptionHash`、`activeSubscriptionHash`、`lastAcceptedSubscriptionHash`。服务端 accepted hash 不可用时，状态文案必须写成 `本地 Hash 不一致`，不能暗示已经完成本地/服务端对比。

### 6.4 交互

- 支持按状态筛选：全部、异常、required、accepted、rejected、local residual。
- 支持搜索 topic key。
- 点击 topic 展开原因细节，包括 policy source、decision trace、scope 统计、最近 projection 样本摘要。
- 提供 `复制诊断` 操作。Phase 1 摘要只包含 local 和 handshake 字段，并显式写入 `serverDiagnostics: "unavailable"`；Phase 3 加入 server policy、decision trace 和 server session 字段。服务端刷新失败且存在旧快照时，摘要写入 `serverDiagnostics: "stale"`、`serverStatus: "failed"`、`serverError` 和 `lastServerSuccessAt`。

## 7. 同步流水线页

该页展示 TDP 从连接到本地 apply 的链路，用于定位“卡在哪一段”。

### 7.1 链路阶段

1. Session：`CONNECTING -> HANDSHAKING -> READY`
2. Snapshot：`snapshotStatus idle/loading/applying/ready/error`
3. Changes：`changesStatus idle/catching-up/ready/error`
4. Delivery：`lastDeliveredCursor`
5. Ack：`lastAckedCursor`
6. Apply：`lastAppliedCursor`
7. Server watermark：`highWatermark`

### 7.2 指标

| 指标 | 来源 | 用途 |
| --- | --- | --- |
| `lastCursor` | `tdpSync` | 本地请求 changes 的起点 |
| `lastDeliveredCursor` | `tdpSync` | 服务端已投递到本地的最高 cursor |
| `lastAckedCursor` | `tdpSync` | 本地确认收到的最高 cursor |
| `lastAppliedCursor` | `tdpSync` | projection 已应用的最高 cursor |
| `highWatermark` | `tdpSession` 或 server session | 服务端当前最高可见 revision |
| `ackLag` | server session 或本地推导 | 服务端认为未 ACK 的距离 |
| `applyLag` | server session 或本地推导 | 服务端认为未 APPLY 的距离 |
| `serverClockOffsetMs` | `tdpSync` | 判断时间戳偏差 |
| snapshot progress | `applyingSnapshotTotalItems / applyingSnapshotAppliedItems` | 判断全量 apply 是否卡住 |

### 7.3 健康判断

- `snapshotStatus=error` 或 `changesStatus=error`：错误。
- `snapshotStatus=applying` 且 applied items 长时间不变：警告，需 observability 提供持续时间。Phase 1 只展示当前 applying 进度，不做“长时间不变”的自动判定。
- `lastDeliveredCursor > lastAckedCursor`：ACK 反馈可能卡住。为避免正常批量处理过程中的短暂误报，Phase 1 只显示差值；Phase 2 起结合持续时间或两个以上刷新周期未变化再标警告。
- `lastAckedCursor > lastAppliedCursor`：projection apply 可能卡住。同样需要持续时间或刷新周期条件。
- `highWatermark > lastDeliveredCursor`：拉取或服务端推送可能落后。断连时显示为 stale watermark，不直接判错。
- `serverClockOffsetMs` 过大：时间偏移警告，影响过期 projection 判断。

## 8. Topic 明细页

该页聚焦每个 topic 的数据规模和近期活动。

### 8.1 统计字段

| 字段 | 当前能否支持 | 说明 |
| --- | --- | --- |
| active entry count | 已支持 | 从 `tdpProjection.activeEntries` 按 topic 聚合 |
| staged entry count | 已支持 | 快照 apply 中的 staged entries |
| max revision | 已支持 | 从 projection envelope 聚合 |
| last occurredAt | 已支持 | 从 projection envelope 聚合 |
| scope 分布 | 已支持 | 按 `scopeType` 聚合 |
| lifecycle 分布 | 已支持 | `persistent / expiring` |
| expired count | 已支持 | 使用 projection expiry 逻辑推导 |
| lastReceivedAt | Phase 2 已接入 | 以终端本机收到 TDP 消息或 HTTP changes 响应的时间为准 |
| lastAppliedAt | Phase 2 已接入 | 以 projection repository 完成 apply 的本机时间为准 |
| 近期频率 | Phase 2 已接入 | 基于 runtime-only rolling window 折算每分钟 received/applied |
| batch size / process lag | 局部支持 | topic activity 已记录批次条目数；完整 ACK/apply processing lag 仍留后续增强 |

### 8.2 展示形态

- 上方小型汇总：topic 总数、accepted topic 数、异常 topic 数、projection 总条目。
- 下方表格：topic 为行，规模、最近更新时间、频率、scope 分布为列。
- 展开行展示最近 3 条 projection envelope 摘要，只显示脱敏后的 `itemKey/scope/revision/occurredAt/lifecycle`，不默认展开完整 payload。
- `itemKey` 可能包含商品、会员、门店或其他业务标识。默认显示短 hash 或中间截断值，复制诊断时也使用脱敏值；研发模式需要明确开关后才允许复制原始 itemKey。

## 9. 本地存储页

该页用于排查“重启恢复为什么不对”和“本地缓存是否异常”。

### 9.1 恢复真相源

展示 `tdpSync` 已持久化字段：

- `lastCursor`
- `lastDeliveredCursor`
- `lastAckedCursor`
- `lastAppliedCursor`
- `activeSubscriptionHash`
- `activeSubscribedTopics`
- `lastRequestedSubscriptionHash`
- `lastRequestedSubscribedTopics`
- `lastAcceptedSubscriptionHash`
- `lastAcceptedSubscribedTopics`
- `serverClockOffsetMs`

这些字段属于 cursor、订阅协商和时钟偏移的最小恢复状态，适合直接展示。

### 9.2 Projection 存储

展示：

- `activeBufferId`
- `stagedBufferId`
- `activeEntries` 总数
- `stagedEntries` 总数
- 按 topic entry count
- 按 lifecycle entry count
- 已过期但尚未清理的 entry count
- `lastExpiredProjectionCleanupAt`

当前代码中 `tdpProjection` 是 `owner-only` record 持久化，flush mode 为 debounced。面板应如实展示这一点，不再沿用“projection raw 完全不持久化”的旧认知。

`activeBufferId` 和 `stagedBufferId` 只放在高级区域，用于排查快照 staging、commit 后 buffer 是否切换成功。普通运维视图优先展示 entry 数、topic 分布、过期项和最近清理时间。

### 9.3 State runtime 诊断能力

如果 state-runtime 未来暴露诊断 selector 或 host tool，本页可以补充：

- hydration 是否完成
- pending flush 数量
- 最近 flush 开始/完成时间
- 最近 flush error
- 持久化 key 数量
- 每个 slice 的存储大小估算

第一版如果没有这些能力，显示 `存储引擎诊断未暴露`，并保留恢复字段和 projection 统计。该能力不属于 TDP observability 的必要前置，可以作为 Phase 2 后的独立增强项接入 state-runtime 诊断 selector 或 admin host tool。

## 10. 事件与告警页

该页展示 TDP 控制信号和近期异常。

字段：

- `lastProtocolError`
- `lastEdgeDegraded`
- `lastRehomeRequired`
- `lastDisconnectReason`
- `disconnectReason`
- `lastPongAt`
- `reconnectAttempt`
- `alternativeEndpoints`
- command inbox count
- 最近 command topic
- 最近 projection cleanup time

建议把这些信息展示为时间线和状态列表：

- 时间线用于最近事件。
- 状态列表用于当前仍然生效的风险，例如 `REHOME_REQUIRED`、`DEGRADED`、`requiredMissingTopics`。

## 11. 服务端诊断页

服务端诊断是增强能力，不应阻塞 local-only 面板上线。它用于把终端视角和服务端视角对齐。

### 11.1 可用 API

mock terminal platform 目前已有或接近可用的接口：

- `GET /api/v1/admin/tdp/sessions`
- `GET /api/v1/admin/tdp/topics`
- `GET /api/v1/admin/tdp/terminals/:terminalId/resolved-topics`
- `GET /api/v1/admin/tdp/terminals/:terminalId/decision-trace`
- `GET /api/v1/admin/tdp/terminals/:terminalId/topics/:topicKey/decision`
- `GET /api/v1/admin/tdp/projections`
- `GET /api/v1/admin/tdp/change-logs`
- `GET /api/v1/admin/tdp/commands`
- `GET /api/v1/admin/tdp/terminals/:terminalId/memberships`

### 11.2 对比内容

| 对比项 | 本地来源 | 服务端来源 |
| --- | --- | --- |
| sessionId | `tdpSession.sessionId` | `/sessions` |
| accepted topics | `tdpSession.subscription.acceptedTopics` | `/sessions.subscription.acceptedTopics` |
| highWatermark | `tdpSession.highWatermark` | `/sessions.highWatermark` |
| ack/apply lag | 本地游标推导 | `/sessions.ackLag/applyLag` |
| profile/template | `tcpBinding` | runtime facts / terminal DB |
| topic policy | 本地 handshake 结果 | decision trace |
| group membership | projection topic | `/memberships` |

### 11.3 失败模式

- 服务端 API 不可达：服务端诊断页显示不可用，但其他页不受影响。
- 服务端无当前 session：提示“本地认为已连接，但服务端无在线 session”，用于定位旧连接、server restart 或 session registry 丢失。
- 服务端 session 与本地 sessionId 不一致：提示“可能存在重连竞态或 UI 读取到旧状态”。
- 服务端 accepted topics 与本地 accepted topics 不一致：提示检查 handshake、订阅 hash 和 session 切换。

### 11.4 服务端诊断状态机

`AdminTdpSection` 对服务端增强诊断使用独立状态机，不影响本地 TDP 面板实时刷新：

| 状态 | 含义 | UI 行为 | 摘要字段 |
| --- | --- | --- | --- |
| `unavailable` | 当前 host 未提供 `AdminTdpHost` | 服务端诊断页显示 `serverDiagnostics: unavailable`，其他页保持 local-only | `serverDiagnostics: "unavailable"` |
| `idle` | host 存在但尚未手动刷新 | 不主动请求服务端，避免 POS 终端后台额外流量 | `serverDiagnostics: "unavailable"` |
| `loading` | 正在请求 `operations-snapshot` | 如果已有旧 snapshot，继续展示旧 snapshot 并提示刷新中 | 复制摘要仍以当前页面状态为准 |
| `ready` | 最近一次刷新成功 | 展示 server-enhanced 视角，记录 `lastServerSuccessAt` | `serverDiagnostics: "available"` |
| `failed` 且无旧 snapshot | 请求失败且没有可展示的服务端视角 | 服务端诊断页显示 `serverDiagnostics: failed` 和失败原因，本地状态仍可看 | `serverDiagnostics: "failed"` |
| `failed` 且有旧 snapshot | 最近请求失败，但有上一份成功 snapshot | 页面继续展示旧 snapshot，并提示“当前展示上次成功快照”和最近失败原因 | `serverDiagnostics: "stale"`、`serverStatus: "failed"`、`serverError`、`lastServerSuccessAt` |

该状态机的核心原则是：服务端增强诊断是运维辅助信息，不是本地 TDP 状态的真相源；刷新失败时不应清空同一 `sandboxId + terminalId` 下的上一份成功诊断，避免现场排障丢失已知上下文。但一旦当前终端身份发生变化，旧 server snapshot 必须退出展示和诊断摘要，防止把上一台终端的 profile/template、topic 能力和 session lag 混入当前终端。

## 12. 数据来源与能力缺口

### 12.1 当前可直接使用

| 能力 | 来源 |
| --- | --- |
| TCP 身份、sandbox、binding、profileId、templateId | `tcp-control-runtime-v2` selectors |
| TDP session status、syncMode、highWatermark、subscription | `tdp-sync-runtime-v2` session selector |
| TDP cursor、subscription hash、snapshot progress | `tdp-sync-runtime-v2` sync selector |
| projection active/staged entries | `tdp-sync-runtime-v2` projection selector |
| command inbox | `tdp-sync-runtime-v2` command inbox selector |
| protocol/degraded/rehome/disconnect signals | `tdp-sync-runtime-v2` control signals selector |
| 服务端 session lag | mock terminal platform admin TDP sessions API |
| 服务端 resolved topics / decision trace | mock terminal platform admin TDP terminal APIs |

### 12.2 建议新增的 kernel 能力

新增 `selectTdpOperationsSnapshot` 或 `selectTdpOperationalDashboard`，由 `tdp-sync-runtime-v2` 提供面向运维的纯 selector 聚合：

- identity summary 可由 UI 组合 TCP selectors，也可以 selector 入参组合。
- session summary
- sync pipeline summary
- subscription summary
- projection topic stats
- control signals summary
- health findings

该 selector 建议纳入 Phase 1。它只聚合现有状态，不新增 runtime 写入语义，目的是避免 `AdminTdpSection` 中堆叠大量 ad hoc 派生逻辑。

新增 runtime-only `tdpObservability` slice，用于专业展示同步频率和本机处理时间：

```ts
interface TdpObservabilityState {
    topics: Record<string, {
        receivedCount: number
        appliedCount: number
        ackedCount: number
        lastReceivedAt?: number
        lastAppliedAt?: number
        lastAckedAt?: number
        lastRevision?: number
        lastBatchSize?: number
        lastProcessingLagMs?: number
        rate1m?: number
        rate5m?: number
    }>
    batches: {
        receivedCount: number
        appliedCount: number
        lastReceivedAt?: number
        lastAppliedAt?: number
        lastBatchSize?: number
    }
}
```

该 slice `persistIntent` 应为 `never`。它只服务排障，不参与重启恢复。

### 12.3 服务端 operations snapshot 能力

当前服务端已有较多 admin API。为了终端面板更专业，本实现新增一个终端专用聚合 API：

`GET /api/v1/admin/tdp/terminals/:terminalId/operations-snapshot?sandboxId=...`

返回：

- terminal facts，包含 profile/template id/code/name
- resolved topics
- topic policy allowlist 和 sources
- online sessions
- current session lag
- topic decision summary
- group memberships
- server high watermark by accepted subscription

其中 `serverAvailableTopics` 的定义必须收窄为：

1. topic 在服务端 registry 中有定义，或 terminal resolved topics 中存在当前终端可见数据；
2. 如果 profile/template policy 产生 allowlist，则 topic 必须同时在 allowlist 中；
3. 被 allowlist 拒绝、非法 topic、required missing topic 不进入 `serverAvailableTopics`，即使它们在 registry 中有定义；
4. allowed 但没有 registry/resolved 数据的 topic 仍然不进入 `serverAvailableTopics`，并通过 finding 提醒 `accepted topic` 当前服务端不可给。

这个口径让 Topic 对比页能区分三类问题：本地未请求、服务端缺定义/缺数据、策略拒绝。不要把“registry 有这个 topic”简化成“当前终端可给这个 topic”。

这样 UI 不需要并发拼多个服务端 API，也更容易做版本兼容。

admin console 不直接拼接这些服务端 API，而是通过可选 `AdminTdpHost.getOperationsSnapshot({sandboxId, terminalId})` 获取统一模型。host tool 不存在、terminal/sandbox 缺失或服务端请求失败时，页面保持 local-only 展示，并在服务端诊断区显示降级原因。

## 13. UI 设计原则

1. 使用现有 `AdminSectionShell`、`AdminSummaryGrid`、`AdminSummaryCard`、`AdminBlock`、`AdminStatusList` 风格，保持 admin console 一致。
2. 页面密度偏运维工具，避免 marketing hero、装饰图、大面积空白。
3. summary card 只承载关键状态；明细用表格和状态列表。
4. 数字字段使用等宽或 tabular 样式，避免游标和计数跳动导致视觉抖动。
5. 健康状态不能只靠颜色，需要有中文状态文本。
6. 默认隐藏完整 payload，避免业务数据泄露和页面噪声；只提供复制诊断摘要。
7. 横向子 Tab 在窄屏下可横向滚动，保留当前子 Tab 状态。
8. 服务端增强能力的入口放在 admin host tools 或 admin console command actor 后面，UI 不直接拼接服务端鉴权细节。

## 14. 落地阶段

### Phase 1：local-only 面板（已实现）

目标：不依赖服务端增强 API，先让终端本机可看 TDP 状态。

改动：

- admin console 新增 `tdp` tab 和 `AdminTdpSection`。
- `tdp-sync-runtime-v2` 新增纯 selector `selectTdpOperationsSnapshot` 或等价命名，聚合当前已有 TDP 状态。
- 读取 TCP/TDP selectors。
- 实现总览、同步流水线、本地存储、事件与告警。
- Topic 对比页先展示本地 requested/accepted/rejected/missing 和 projection 本地存在情况。
- 频率、服务端能力列显示 `未暴露` 或 `服务端诊断未连接`。

验证：

- admin console 可切到 TDP 数据平面。
- 未激活终端、未连接 TDP、READY、ERROR、snapshot applying 等状态都有可读展示。
- 不引入业务包依赖。
- 使用 selector fixture 或组件测试构造未激活、断连、READY、ERROR、snapshot applying、rejected topic、required missing 等状态；集成验证再连接 mock terminal platform 读取真实 store state。

### Phase 2：补 TDP observability（已实现）

目标：让 topic 级频率、最近收到时间、最近 apply 时间准确可用。

改动：

- `tdp-sync-runtime-v2` 新增 runtime-only topic activity slice，`persistIntent: never`，重启后不作为恢复真相源。
- 在 message actor、changes fetch actor 和 projection repository actor 记录本地 received/apply 时间，并按 snapshot、changes、realtime 拆分 topic 活动量。
- `selectTdpOperationsSnapshot` 聚合总 activity、topic activity、热点 topics、recent received/applied per-minute 和本地 health findings。
- admin console 增加 `Topic 明细`、topic 筛选和诊断摘要生成；摘要显式标记 `serverDiagnostics: unavailable`。
- 服务端能力对比、服务端 decision trace、profile/template 名称补全仍保持在 Phase 3，不在 Phase 2 混入 UI 直连服务端逻辑。

验证：

- 单元测试覆盖 batch received、projection applied、ack sent 的指标更新。
- 重启后 observability 清空，不影响 cursor/projection 恢复。用状态恢复集成测试验证：重启前写入 cursor/projection，重启后 cursor/projection 保留，observability counters 归零，TDP 仍按 last cursor 继续握手。

### Phase 3：server-enhanced 诊断（已实现到 Android host wiring）

目标：实现本地需求和服务端能力的完整对比。

已完成改动：

- mock terminal platform 新增 `GET /api/v1/admin/tdp/terminals/:terminalId/operations-snapshot?sandboxId=...`。
- server snapshot 聚合 terminal facts、profile/template id/code/name、topic registry、profile/template policy、resolved topics、sessions、subscription、decision trace 和 findings。
- admin console 类型层新增 `AdminTdpHost` / `AdminTdpServerOperationsSnapshot`，默认 TDP section 接收可选 host tool。
- admin host tools factory 和 module input factory 透传 `tdp` host，保持 UI 只依赖 host tool，不直接拼服务端 URL。
- Android `host-runtime-rn84` 注入真实 `AdminTdpHost`，按 `mockTerminalPlatformBaseUrl` 或当前 transport server space 解析 mock terminal platform 地址，请求 `operations-snapshot` 并解包 `{success,data}` 响应。
- `mixc-catering-assembly-rn84` 的 `createApp` 将 `mockTerminalPlatformBaseUrl` 继续传入 admin console host input，assembly 只保留 thin wiring。
- Topic 对比页合并 local/server/handshake 三方结果，服务端未连接时明确显示 `服务端诊断未连接`。
- 服务端诊断页展示 server-enhanced 模式、服务端 Terminal、Session、Policy、Decision 和 findings。
- 支持手动刷新服务端诊断和复制包含 server snapshot 的诊断摘要。
- 服务端请求失败或 host 不存在时保留 local-only 结果，并在服务端诊断页显示失败原因。
- 服务端请求失败但已有上一份成功 snapshot 时，继续展示旧 snapshot，标记 `serverDiagnostics: stale`，并显示最近成功刷新时间和最新失败原因。
- 服务端 snapshot 绑定 `sandboxId + terminalId`，终端身份变化后回到未刷新状态，不复用上一台终端的 server-enhanced 视角。
- `serverAvailableTopics` 按 registry/resolved 数据与 profile/template policy 共同收窄，不把策略拒绝的 topic 误判为可给。

已覆盖验证：

- 服务端 API 测试覆盖 profile/template allowlist、policy sources、requested/accepted/rejected、current session、策略拒绝 topic 不进入 `serverAvailableTopics`，以及 accepted topic 不在服务端 registry/resolved topics 时的 warning finding。
- Admin UI 测试覆盖 local-only 降级、host 刷新按钮、请求参数、profile/template 名称补全、Topic 服务端能力对比、服务端告警、诊断摘要生成、刷新失败后保留同一终端上一份成功 snapshot 的 stale 展示，以及终端身份变化后不复用旧 server snapshot。
- host-runtime / assembly 测试覆盖 `AdminTdpHost` 注入、mock terminal platform URL 拼接、`sandboxId` 参数传递、服务端 envelope 解包，以及 `createApp` 对 `mockTerminalPlatformBaseUrl` 的透传。

后续增强：

- 在真实 Android 设备或当前 VM 上打开 admin console，点击 `刷新服务端诊断`，确认 server-enhanced 数据能从 mock terminal platform 返回并进入 Topic 对比 / 服务端诊断页。
- 若后续需要更细粒度排障，可在 server snapshot 中增加 group membership 明细和 server high watermark by accepted subscription 的专门字段。

## 15. 测试策略

1. Selector 单元测试：覆盖 health findings、topic 聚合、projection count、cursor lag。
2. Admin UI 组件测试：覆盖 tab 注册、local-only 空状态、READY 状态、异常状态、topic 对比行。
3. 服务端 API 测试：覆盖 operations snapshot 或现有多 API 的 profile/template policy、resolved topics、decision trace。
4. 集成验证：启动 mock platform 和终端 runtime，确认 admin console 能看到 accepted/rejected/missing topics 和 cursor 变化，并在 Android host 注入后手动刷新服务端诊断。
5. 重启恢复验证：保存 cursor/projection 后重启，确认本地存储页展示恢复字段，observability 不参与恢复。

## 16. 风险与约束

1. 频率和 lastReceivedAt 不能从 projection `occurredAt` 准确替代。`occurredAt` 是数据发生时间，不是本机收到时间。
2. 服务端增强 API 的鉴权和网络通道需要按现有 host tools/command 方式设计，不能让 UI 直接绕过 kernel 边界随意访问。
3. profile/template 的 code/name 当前不一定在本地 state 中，需要服务端 runtime facts 或终端配置 API 补齐。
4. Topic 对比不能假设所有 topic 都是 projection。command/system topic 要允许没有 projection 条目。
5. projection payload 可能包含业务数据，默认不要直接展示完整 payload。

## 17. 推荐结论

三阶段推进已经完成到 Android host wiring：**local-only TDP 数据平面** 提供终端现场排障基础，`tdpTopicActivity` 让频率和最近同步时间成为本机真实指标，服务端 `operations-snapshot` 则把 profile/template 策略、服务端 resolved topics 和 session lag 纳入同一个诊断面板。真实终端上，admin console 仍只调用 `AdminTdpHost`，由 host-runtime 负责连接 mock terminal platform 或未来正式终端平台 admin API。

当前剩余的主要工程点不是 UI 设计、数据模型或 host 注入，而是真机慢机环境的复跑：当前 Android VM 已验证 server-enhanced 刷新链路可用，但性能和多屏卡顿结论仍应以真实设备上的点击与日志证据为准。
