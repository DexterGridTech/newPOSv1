# TDP Dynamic Group / Projection Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `mock-terminal-platform` 与 `tdp-sync-runtime-v2` 中落地 TDP Dynamic Group / Projection Policy，支持服务端动态 selector group、membership 物化、group-scope policy、终端侧 resolved projection 生效，以及后台可观测/可运维能力。

**Architecture:** 第一阶段先把服务端控制面和数据面打通：新增 `selector_groups`、`selector_group_memberships`、`projection_policies` 三类真相源，服务端在 group / terminal / policy 变化时同步重算 membership 并物化到现有 `tdp_projections` 与 `tdp_change_logs`。终端继续复用现有 resolved projection 路径，只新增 `GROUP` scope 链拼装与 membership 读取，不引入第二套本地策略引擎。

**Tech Stack:** Express, ws, Drizzle/SQLite, React/Vite, Redux Toolkit, Vitest, runtime-shell-v2, tdp-sync-runtime-v2

---

## Execution Status

### Completed on 2026-04-18

- 服务端已落地 `selector_groups`、`selector_group_memberships`、`projection_policies` 三类真相源，并接入现有 `tdp_projections` / `tdp_change_logs` 物化链。
- `GROUP` scope 已纳入终端 resolved projection 链，顺序固定为 `PLATFORM < PROJECT < BRAND < TENANT < STORE < GROUP(rank asc) < TERMINAL`。
- 已支持 selector group 的创建、更新、删除、按 terminal/project/group/recompute-all 重算、terminal memberships、group memberships、group stats。
- 已支持 projection policy 的创建、更新、删除、validate、preview-impact、按 policyId 查询。
- 已支持终端 decision trace、resolved topics、按 topic decision explain。
- 管理后台已接入最小策略中心页面，支持：
  - overview 统计
  - group preview
  - group stats / members / policies
  - policy validate
  - policy impact preview
  - terminal membership / decision trace

### Verified Evidence

- `./node_modules/.bin/vitest run 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`
- `corepack yarn workspace @next/mock-terminal-platform-server type-check`
- `corepack yarn workspace @next/mock-terminal-platform-web type-check`
- `corepack yarn workspace @next/mock-terminal-platform-web build`
- `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 type-check`
- `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-live-group-policy.spec.ts`
- `corepack yarn workspace @next/kernel-base-workflow-runtime-v2 type-check`
- `corepack yarn workspace @next/kernel-base-workflow-runtime-v2 test test/scenarios/workflow-runtime-v2-live-remote-definitions.spec.ts`

### Remaining Next Slice

- 后台 UI 仍是最小可用版，后续可继续补：
  - group/policy 详情抽屉
  - topic 维度 decision 过滤
  - impact large / stale / conflict badge
  - 审计 deep-link
  - policy detail panel

---

## Implementation Invariants

- `GROUP` 只是在外层 fixed scope chain 中新增一个横切 bucket，位置固定为 `PLATFORM < PROJECT < BRAND < TENANT < STORE < GROUP(rank asc) < TERMINAL`；不要把 `group.priority` 解释为可动态插入外层链位置的字段。
- 第一版 runtime facts 直接复用 `terminal_instances` 作为持久化真相源；不新增 `terminal_runtime_facts`，只在必要时补齐缺失字段或结构化 JSON。
- `projection_policies` 不引入独立 `priority` 字段；同一 `topicKey + itemKey + scopeType + scopeKey` bucket 在同一时刻只允许一条 enabled policy。
- Selector DSL v1 只支持白名单字段、字段内 OR、字段间 AND、`capabilitiesAll` 全量包含；明确不支持 `capabilitiesAny`、not、range、regex、script。
- `sandboxId` 是硬隔离边界；group、membership、policy、projection materialization、decision trace 都只能在同一 sandbox 内计算与展示。

---

## File Map

### Server core

- Modify: `0-mock-server/mock-terminal-platform/server/src/database/schema.ts`
  新增 `selector_groups`、`selector_group_memberships`、`projection_policies` 表定义；第一版继续复用 `terminal_instances` 保存 runtime facts，不新增 `terminal_runtime_facts`。
- Modify: `0-mock-server/mock-terminal-platform/server/src/database/index.ts`
  初始化新表、补齐索引和 seed topic（尤其是 `terminal.group.membership`）所需的数据库建表逻辑。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupTypes.ts`
  收敛 selector DSL、membership、decision trace、policy center API 的类型约定，避免把控制面结构散落在 routes/service 中。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupMatcher.ts`
  实现 selector DSL v1 的匹配逻辑，只支持 spec 定义的白名单字段与 `capabilitiesAll`，不支持 `capabilitiesAny` 等扩展语法。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupService.ts`
  管理 selector group CRUD、membership 重算、排序、membershipVersion 推进、group 删除保护与 `terminal.group.membership` projection 物化；`priority` 只用于 group bucket 内排序。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/policyService.ts`
  管理 `projection_policies` CRUD、冲突校验、group policy / 原 scope policy 物化、impact preview、删除保护。
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
  抽出复用型 projection/change-log fan-out 基础函数；同时补 runtime facts upsert 入口，让 group membership 和 policy 物化复用现有终端投递链路，而不是重复写 SQL。
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts`
  维持现有消息大类不变，但补齐 `terminal.group.membership` 这类系统 topic 的 envelope 约定说明与测试约束。
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`
  保持现有 `FULL_SNAPSHOT / CHANGESET / PROJECTION_CHANGED / PROJECTION_BATCH` 通道；确保 membership 物化后按既有推送链路在线立即送达、离线可补齐。
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`
  新增 TDP 策略中心相关 API：groups、memberships、policies、decision trace、preview impact、批量 recompute。
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/audit.ts`
  为 group / policy / recompute 写审计事件，满足后台追溯要求。
- Modify: `0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer.ts`
  保持测试 server 能跑完整 TDP 控制面 + 数据面联调。
- Create: `0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`
  覆盖 group CRUD、membership 重算、policy 物化、冲突、删除保护、decision trace 等服务端核心行为。

### Admin web

- Modify: `0-mock-server/mock-terminal-platform/web/src/api.ts`
  新增 group / membership / policy / decision trace / recompute 相关请求封装。
- Modify: `0-mock-server/mock-terminal-platform/web/src/types.ts`
  新增策略中心页面所需 DTO 与筛选条件类型。
- Modify: `0-mock-server/mock-terminal-platform/web/src/App.tsx`
  仅新增 `TDP 策略中心` 页面入口与容器挂载，接入当前 sandbox 视图。
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/useTdpPolicyCenter.ts`
  收敛策略中心页面状态、数据加载与操作编排，避免继续把大量状态堆进 `App.tsx`。
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/*`
  承载 group 列表、详情、memberships、policies、impact preview、decision trace 等后台 UI 组件。

### Kernel / terminal runtime

- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts`
  扩展 scope type，纳入 `GROUP`。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/state.ts`
  为 membership resolved state 增加可读结构。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/tdpSync.ts`
  把 `terminal.group.membership` 的 `groups[]` 注入 scope priority chain。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/topicChangePublisher.ts`
  确保 membership 变化能驱动依赖 topic 的最终真相重算。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts`
  保持现有连接协议不变，但验证新 scope 类型与恢复路径兼容。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/groupMembership.ts`
  导出 `selectTerminalGroupMembership` 等辅助 selector，供业务与调试使用。

### Verification

- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2.spec.ts`
  增加非 live 的最小 selector/解析测试，并显式补测试 helper，不依赖不存在的 seed builder。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`
  验证 membership projection 可被终端收到并纳入 resolved projection。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`
  验证 membership 与 group policy 在断线/重启后可恢复。
- Modify: `1-kernel/1.1-base/workflow-runtime-v2/test/scenarios/workflow-runtime-v2-live-remote-definitions.spec.ts`
  验证 workflow definition 通过 group policy 生效，确保已有消费方可直接复用。

## Tasks

### Task 1: 建立服务端 group / membership 控制面真相源

**Files:**
- Modify: `0-mock-server/mock-terminal-platform/server/src/database/schema.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/database/index.ts`
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupTypes.ts`
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupMatcher.ts`
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupService.ts`
- Create: `0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`

- [ ] **Step 1: 写失败测试，锁定 selector group / membership 基本契约**

在 `0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts` 新增最小测试，先固定四件事：准备 `kernel-base-test` 种子沙箱、激活一个真实 terminal、group 可创建、membership 排序遵守 `priority -> updatedAt -> groupId`。这里直接复用现有 `/mock-debug/kernel-base-test/prepare` 种子入口，不另造测试数据装配路径。

```ts
it('recomputes ordered memberships for a terminal', async () => {
  const server = createMockTerminalPlatformTestServer()
  await server.start()

  const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
    method: 'POST',
  })
  const preparePayload = await prepareResponse.json() as {
    data: { sandboxId: string }
  }
  const sandboxId = preparePayload.data.sandboxId

  const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sandboxId,
      activationCode: '200000000001',
      deviceFingerprint: 'device-kernel-base-group-001',
      deviceInfo: {
        id: 'device-kernel-base-group-001',
        model: 'Mixc Retail Android RN84',
        osVersion: 'Android 14',
      },
    }),
  })
  const activationPayload = await activationResponse.json() as {
    data: {
      terminalId: string
      binding: {
        projectId: string
        templateId: string
      }
    }
  }
  const terminalId = activationPayload.data.terminalId

  const createGroup = async (body: Record<string, unknown>) => {
    const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandboxId, ...body }),
    })
    expect(response.status).toBe(201)
    return response.json()
  }

  await createGroup({
    groupCode: 'project-default',
    name: 'Project Default',
    priority: 100,
    selectorDslJson: {
      match: { projectId: [activationPayload.data.binding.projectId] },
    },
  })
  await createGroup({
    groupCode: 'template-gray',
    name: 'Template Gray',
    priority: 200,
    selectorDslJson: {
      match: { templateId: [activationPayload.data.binding.templateId] },
    },
  })

  const recompute = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sandboxId,
      scopeType: 'TERMINAL',
      scopeKeys: [terminalId],
    }),
  })
  expect(recompute.status).toBe(200)

  const membershipsResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/terminals/${terminalId}/memberships?sandboxId=${sandboxId}`)
  const membershipsPayload = await membershipsResponse.json()

  expect(membershipsPayload.data.groups.map((item: { groupCode: string }) => item.groupCode)).toEqual([
    'project-default',
    'template-gray',
  ])
  await server.close()
})
```

- [ ] **Step 2: 运行聚焦服务端测试，确认现在失败**

Run: `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`

Expected: FAIL，原因是数据库、路由、group service 尚不存在。

- [ ] **Step 3: 在数据库层补齐三张控制面表和必要索引**

在 `0-mock-server/mock-terminal-platform/server/src/database/schema.ts` 与 `0-mock-server/mock-terminal-platform/server/src/database/index.ts` 新增 `selector_groups`、`selector_group_memberships`、`projection_policies`；runtime facts 第一版直接复用 `terminal_instances`，补齐会话期事实字段的持久化契约，至少覆盖：
- 继续复用现有 `currentAppVersion` / `currentBundleVersion` / `deviceInfoJson`
- 追加 `protocolVersion`、`capabilitiesJson`、`runtimeInfoJson` 或等价结构化字段
- 不新增 `terminal_runtime_facts`

并给以下组合键建唯一性或查询索引：

```ts
export const selectorGroupsTable = sqliteTable('selector_groups', {
  groupId: text('group_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  groupCode: text('group_code').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  enabled: integer('enabled').notNull(),
  priority: integer('priority').notNull(),
  selectorDslJson: text('selector_dsl_json').notNull(),
  membershipVersion: integer('membership_version').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const selectorGroupMembershipsTable = sqliteTable('selector_group_memberships', {
  membershipId: text('membership_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  groupId: text('group_id').notNull(),
  terminalId: text('terminal_id').notNull(),
  rank: integer('rank').notNull(),
  matchedByJson: text('matched_by_json').notNull(),
  membershipVersion: integer('membership_version').notNull(),
  computedAt: integer('computed_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const projectionPoliciesTable = sqliteTable('projection_policies', {
  policyId: text('policy_id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  topicKey: text('topic_key').notNull(),
  itemKey: text('item_key').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeKey: text('scope_key').notNull(),
  enabled: integer('enabled').notNull(),
  payloadJson: text('payload_json').notNull(),
  description: text('description').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
```

同时在 `initializeDatabase()` 中补唯一约束语义：
- `selector_groups(sandbox_id, group_code)`
- `selector_group_memberships(sandbox_id, terminal_id, group_id)`
- `projection_policies(sandbox_id, topic_key, item_key, scope_type, scope_key)`

- [ ] **Step 4: 收敛 group 类型和 selector DSL v1 匹配器**

在 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupTypes.ts` 定义白名单字段，在 `groupMatcher.ts` 实现仅支持 spec 的 AND / OR / `capabilitiesAll` 语义；不要在这一轮提前引入 `capabilitiesAny` 或更复杂表达式。

```ts
export interface SelectorDslV1 {
  match: Partial<{
    platformId: string[]
    projectId: string[]
    tenantId: string[]
    brandId: string[]
    storeId: string[]
    profileId: string[]
    templateId: string[]
    assemblyAppId: string[]
    runtimeVersion: string[]
    assemblyVersion: string[]
    bundleVersion: string[]
    protocolVersion: string[]
    devicePlatform: string[]
    deviceModel: string[]
    deviceOsVersion: string[]
    capabilitiesAll: string[]
  }>
}

export const matchTerminalAgainstSelector = (
  facts: TerminalRuntimeFacts,
  selector: SelectorDslV1,
): { matched: boolean; matchedBy: Record<string, string> } => {
  // 同字段 OR、跨字段 AND、capabilitiesAll 全量包含
}
```

- [ ] **Step 5: 实现 group service 的最小 CRUD + terminal membership 重算**

在 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupService.ts` 先只实现首轮最小闭环：
- `createSelectorGroup`
- `listSelectorGroups`
- `recomputeTerminalMemberships`
- `getTerminalGroupMemberships`

其中 `recomputeTerminalMemberships` 必须完成：
1. 读取 terminal 主数据 + 运行时画像
2. 扫描 sandbox 内 enabled groups
3. 调 matcher 计算命中结果
4. 按 `priority asc -> updatedAt asc -> groupId asc` 生成 rank
5. 同事务更新该 terminal 的 membership 记录，并递增受影响 group 的 `membershipVersion`
6. `DELETE group` 前检查是否存在 enabled policy 绑定，存在则拒绝删除

补充约束：
- `priority` 只影响 `GROUP` bucket 内顺序，不改变外层 `STORE < GROUP < TERMINAL` 的固定位置
- 同一 terminal 的 membership 重算必须串行提交，`membershipVersion` 递增与 membership 写入放在同一事务里

```ts
export const recomputeTerminalMemberships = (input: {
  sandboxId: string
  terminalId: string
}) => {
  assertSandboxUsable(input.sandboxId)
  const terminal = getTerminalFacts(input.sandboxId, input.terminalId)
  const groups = listEnabledSelectorGroups(input.sandboxId)
  const matches = groups
    .map(group => ({ group, result: matchTerminalAgainstSelector(terminal, parseSelector(group.selectorDslJson)) }))
    .filter(item => item.result.matched)
    .sort(compareGroupOrder)

  sqlite.transaction(() => {
    replaceTerminalMembershipRows(input.sandboxId, input.terminalId, matches)
  })()

  return { terminalId: input.terminalId, groups: matches.map(toMembershipDto) }
}
```

- [ ] **Step 6: 补 runtime facts upsert 最小闭环，确保 selector 的运行时字段可命中**

第一版至少落一条统一的 runtime facts upsert 路径：TDP `HANDSHAKE` 成功时，把 `appVersion / protocolVersion / capabilities` 与终端已有 `deviceInfoJson` 合并保存，并在 facts 变化后触发 terminal membership 重算。

```ts
export const upsertTerminalRuntimeFacts = (input: {
  sandboxId: string
  terminalId: string
  appVersion: string
  protocolVersion: string
  capabilities: string[]
  runtimeInfo?: {
    assemblyAppId?: string
    bundleVersion?: string
    runtimeVersion?: string
    assemblyVersion?: string
  }
}) => {
  // 1. upsert terminal_instances 或 terminal_runtime_facts
  // 2. compare previous facts
  // 3. if changed -> recomputeTerminalMemberships(...)
}
```

- [ ] **Step 7: 运行聚焦测试，确认 membership 基础能力通过**

Run: `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`

Expected: PASS，至少覆盖 group 创建、terminal membership 命中与排序。

- [ ] **Step 8: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/server/src/database/schema.ts 0-mock-server/mock-terminal-platform/server/src/database/index.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupTypes.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupMatcher.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupService.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts
git commit -m "Add TDP selector group and membership control plane"
```

### Task 2: 接通 policy 物化与后台服务端 API

**Files:**
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/policyService.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/audit.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`

- [ ] **Step 1: 写失败测试，锁定 policy -> projection / change-log 物化契约**

在 `0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts` 增加测试，验证给 group 创建 policy 后：
1. `tdp_projections` 出现 `scopeType=GROUP` 的记录
2. 目标 terminal 的 snapshot / changes 能看见对应 topic
3. disabled / delete 能回滚物化结果

```ts
it('materializes group policy into projection and terminal changes', async () => {
  const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sandboxId,
      topicKey: 'workflow.definition',
      itemKey: 'cashier-main',
      scopeType: 'GROUP',
      scopeKey: hotfixGroupId,
      enabled: true,
      payloadJson: {
        version: 'gray.001',
        steps: [],
      },
      description: 'gray workflow hotfix',
    }),
  })
  expect(response.status).toBe(201)

  const snapshotResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/tdp/terminals/terminal_kernel_base_001/snapshot?sandboxId=${sandboxId}`)
  const snapshotPayload = await snapshotResponse.json()

  expect(snapshotPayload.data.some((item: { topic: string; scopeType: string; scopeId: string }) => (
    item.topic === 'workflow.definition'
      && item.scopeType === 'GROUP'
      && item.scopeId === hotfixGroupId
  ))).toBe(true)
})
```

- [ ] **Step 2: 运行聚焦测试，确认现在失败**

Run: `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts -t "materializes group policy"`

Expected: FAIL，原因是 policy service 和管理 API 尚不存在。

- [ ] **Step 3: 在 TDP service 中抽出可复用的 projection / change-log fan-out 基础函数**

在 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts` 把当前 `upsertProjection` / `upsertProjectionBatch` 里的公共逻辑收敛为内部辅助函数，供 policy service 与 membership 物化复用。

```ts
export const materializeProjectionToTerminals = (input: {
  sandboxId: string
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  payloadJson: string
  operation: 'upsert' | 'delete'
  targetTerminalIds: string[]
  sourceReleaseId?: string | null
}) => {
  // 1. upsert/delete tdp_projections
  // 2. append terminal-level change logs
  // 3. push to online sessions via existing queue
}
```

要求：
- 对 `GROUP` scope 保留 group-level projection，不把数据面真相拍平成 terminal scope projection
- change log 仍按 terminal fan-out
- 同事务内完成 projection 与 change-log 更新

- [ ] **Step 4: 实现 policy service，保证控制面与数据面同步成功或同步失败**

在 `0-mock-server/mock-terminal-platform/server/src/modules/tdp/policyService.ts` 实现以下最小 API：
- `createProjectionPolicy`
- `updateProjectionPolicy`
- `deleteProjectionPolicy`
- `listProjectionPolicies`
- `previewPolicyImpact`

并落实约束：
1. 同 `sandboxId + topicKey + itemKey + scopeType + scopeKey` 不允许多个 enabled policy
2. `GROUP` scope policy 创建/更新时，按当前 membership 找 target terminals 后同步物化
3. disabled / delete 时，删除对应 `tdp_projections` 并向受影响 terminals 追加 delete change
4. 若当前 membership 为空，允许 policy 保存成功，但返回/展示 `currentMatchedTerminalCount = 0`，不把“当前无命中终端”当作创建失败
5. 不给 `projection_policies` 再增加 priority；同 bucket 的覆盖关系完全由 outer scope precedence + group rank 决定

```ts
export const createProjectionPolicy = (input: CreateProjectionPolicyInput) => {
  assertNoEnabledPolicyConflict(input)
  return sqlite.transaction(() => {
    const policy = insertPolicyRow(input)
    if (policy.enabled) {
      const targets = resolvePolicyTargetTerminalIds(policy)
      materializeProjectionToTerminals({
        sandboxId: policy.sandboxId,
        topicKey: policy.topicKey,
        itemKey: policy.itemKey,
        scopeType: policy.scopeType,
        scopeKey: policy.scopeKey,
        payloadJson: policy.payloadJson,
        operation: 'upsert',
        targetTerminalIds: targets,
      })
    }
    return policy
  })()
}
```

- [ ] **Step 5: 在管理路由接入第一批后台 API，并写审计日志**

在 `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts` 新增：
- `GET /api/v1/admin/tdp/groups`
- `POST /api/v1/admin/tdp/groups`
- `PUT /api/v1/admin/tdp/groups/:groupId`
- `DELETE /api/v1/admin/tdp/groups/:groupId`
- `POST /api/v1/admin/tdp/groups/:groupId/recompute`
- `GET /api/v1/admin/tdp/groups/:groupId/memberships`
- `GET /api/v1/admin/tdp/groups/:groupId/stats`
- `GET /api/v1/admin/tdp/groups/:groupId/policies`
- `GET /api/v1/admin/tdp/terminals/:terminalId/memberships`
- `POST /api/v1/admin/tdp/groups/recompute-all`
- `POST /api/v1/admin/tdp/groups/recompute-by-scope`
- `GET /api/v1/admin/tdp/policies`
- `POST /api/v1/admin/tdp/policies`
- `PUT /api/v1/admin/tdp/policies/:policyId`
- `DELETE /api/v1/admin/tdp/policies/:policyId`
- `GET /api/v1/admin/tdp/policies/:policyId`
- `POST /api/v1/admin/tdp/policies/validate`
- `GET /api/v1/admin/tdp/policy-center/overview`
- `POST /api/v1/admin/tdp/policies/preview-impact`
- `GET /api/v1/admin/tdp/terminals/:terminalId/decision-trace`
- `GET /api/v1/admin/tdp/terminals/:terminalId/topics/:topicKey/decision`

接口语义约束：
- `decision-trace` 返回 terminal 的全量 membership / candidate chain / resolved results 总览
- `topics/:topicKey/decision` 返回单 topic explanation，不与 `decision-trace` 混用

示例：

```ts
router.post('/api/v1/admin/tdp/policies', (req, res) => {
  try {
    const result = createProjectionPolicy(req.body)
    appendAuditLog({
      domain: 'TDP_POLICY',
      action: 'CREATE_PROJECTION_POLICY',
      targetId: result.policyId,
      detail: req.body,
    })
    return created(res, result)
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : '创建 policy 失败', 400)
  }
})
```

- [ ] **Step 6: 运行服务端聚焦测试，确认 policy 物化闭环通过**

Run: `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts`

Expected: PASS，至少覆盖：
- policy 创建后的 projection/change-log 物化
- enabled conflict 拦截
- group delete 前若仍绑定 policy 则拒绝

- [ ] **Step 7: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/server/src/modules/tdp/policyService.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts 0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts 0-mock-server/mock-terminal-platform/server/src/modules/admin/audit.ts 0-mock-server/mock-terminal-platform/server/src/test/tdp-dynamic-group.spec.ts
git commit -m "Materialize TDP group policies through existing projection fanout"
```

### Task 3: 为管理后台补齐 TDP 策略中心页面

**Files:**
- Modify: `0-mock-server/mock-terminal-platform/web/src/api.ts`
- Modify: `0-mock-server/mock-terminal-platform/web/src/types.ts`
- Modify: `0-mock-server/mock-terminal-platform/web/src/App.tsx`
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/useTdpPolicyCenter.ts`
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/GroupListPanel.tsx`
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/GroupDetailPanel.tsx`
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/PolicyListPanel.tsx`
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/PolicyEditorPanel.tsx`
- Create: `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/DecisionTracePanel.tsx`

- [ ] **Step 1: 先写类型，锁定策略中心页面 DTO**

在 `0-mock-server/mock-terminal-platform/web/src/types.ts` 新增 group、membership、group stats、policy、impact preview、decision trace 类型，保持与服务端 API 一致。

```ts
export interface SelectorGroupItem {
  groupId: string
  groupCode: string
  name: string
  description: string
  enabled: boolean
  priority: number
  membershipVersion: number
  selectorDslJson: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface TerminalGroupMembershipView {
  terminalId: string
  membershipVersion: number
  groups: Array<{
    groupId: string
    groupCode: string
    name: string
    priority: number
    rank: number
    matchedBy: Record<string, string>
  }>
}

export interface SelectorGroupStats {
  groupId: string
  matchedTerminalCount: number
  enabledPolicyCount: number
  lastComputedAt: number | null
}

export interface ProjectionPolicyItem {
  policyId: string
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  enabled: boolean
  payloadJson: Record<string, unknown>
  description: string
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 2: 给 `api.ts` 增加策略中心请求封装**

在 `0-mock-server/mock-terminal-platform/web/src/api.ts` 追加以下接口，延续当前 `request()` 与自动注入 `sandboxId` 模式。

```ts
getSelectorGroups: () => request<SelectorGroupItem[]>('/api/v1/admin/tdp/groups'),
createSelectorGroup: (payload: Record<string, unknown>) => request<SelectorGroupItem>('/api/v1/admin/tdp/groups', {
  method: 'POST',
  body: JSON.stringify(payload),
}),
updateSelectorGroup: (groupId: string, payload: Record<string, unknown>) => request<SelectorGroupItem>(`/api/v1/admin/tdp/groups/${groupId}`, {
  method: 'PUT',
  body: JSON.stringify(payload),
}),
deleteSelectorGroup: (groupId: string) => request(`/api/v1/admin/tdp/groups/${groupId}`, {
  method: 'DELETE',
}),
recomputeSelectorGroup: (groupId: string) => request(`/api/v1/admin/tdp/groups/${groupId}/recompute`, {
  method: 'POST',
  body: JSON.stringify({}),
}),
getSelectorGroupStats: (groupId: string) => request<SelectorGroupStats>(`/api/v1/admin/tdp/groups/${groupId}/stats`),
getTerminalGroupMemberships: (terminalId: string) => request<TerminalGroupMembershipView>(`/api/v1/admin/tdp/terminals/${terminalId}/memberships`),
recomputeGroupsByScope: (payload: Record<string, unknown>) => request('/api/v1/admin/tdp/groups/recompute-by-scope', {
  method: 'POST',
  body: JSON.stringify(payload),
}),
recomputeAllGroups: () => request('/api/v1/admin/tdp/groups/recompute-all', {
  method: 'POST',
  body: JSON.stringify({}),
}),
getPolicyCenterOverview: () => request<TdpPolicyCenterOverview>('/api/v1/admin/tdp/policy-center/overview'),
getProjectionPolicies: () => request<ProjectionPolicyItem[]>('/api/v1/admin/tdp/policies'),
createProjectionPolicy: (payload: Record<string, unknown>) => request<ProjectionPolicyItem>('/api/v1/admin/tdp/policies', {
  method: 'POST',
  body: JSON.stringify(payload),
}),
updateProjectionPolicy: (policyId: string, payload: Record<string, unknown>) => request<ProjectionPolicyItem>(`/api/v1/admin/tdp/policies/${policyId}`, {
  method: 'PUT',
  body: JSON.stringify(payload),
}),
deleteProjectionPolicy: (policyId: string) => request(`/api/v1/admin/tdp/policies/${policyId}`, {
  method: 'DELETE',
}),
getProjectionPolicy: (policyId: string) => request<ProjectionPolicyItem>(`/api/v1/admin/tdp/policies/${policyId}`),
validateProjectionPolicy: (payload: Record<string, unknown>) => request<{ valid: boolean; conflicts: Array<Record<string, unknown>> }>('/api/v1/admin/tdp/policies/validate', {
  method: 'POST',
  body: JSON.stringify(payload),
}),
previewPolicyImpact: (payload: Record<string, unknown>) => request<PolicyImpactPreview>('/api/v1/admin/tdp/policies/preview-impact', {
  method: 'POST',
  body: JSON.stringify(payload),
}),
getTerminalDecisionTrace: (terminalId: string) => request<TerminalDecisionTrace>(
  `/api/v1/admin/tdp/terminals/${terminalId}/decision-trace`,
),
getTerminalTopicDecision: (terminalId: string, topicKey: string) => request<TopicDecisionTrace>(
  `/api/v1/admin/tdp/terminals/${terminalId}/topics/${encodeURIComponent(topicKey)}/decision`,
),
```

- [ ] **Step 3: 先用独立 hook 收敛策略中心状态，再让 `App.tsx` 只做挂载**

当前 `App.tsx` 已经承载大量状态；不要继续直接追加多组 `useState`。先新增 `useTdpPolicyCenter.ts`，把策略中心的列表、详情、reload、preview、decision-trace 状态收敛进去；`App.tsx` 只保留 section 注册和容器挂载。

```ts
export const useTdpPolicyCenter = () => {
  const [selectorGroups, setSelectorGroups] = useState<SelectorGroupItem[]>([])
  const [projectionPolicies, setProjectionPolicies] = useState<ProjectionPolicyItem[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [decisionTrace, setDecisionTrace] = useState<TerminalDecisionTrace | null>(null)

  const reload = async () => {
    const [groups, policies, overview] = await Promise.all([
      api.getSelectorGroups(),
      api.getProjectionPolicies(),
      api.getPolicyCenterOverview(),
    ])
    setSelectorGroups(groups)
    setProjectionPolicies(policies)
  }

  return { selectorGroups, projectionPolicies, selectedGroupId, setSelectedGroupId, reload, decisionTrace, setDecisionTrace }
}
```

- [ ] **Step 4: 在 `App.tsx` 新增策略中心入口，并复用现有 sandbox 切换与 detail 面板模式**

当前页面已有 `TDP 数据面` section；新增并列 section `TDP 策略中心`，不要把策略中心继续塞进现有 TDP 数据面视图里，否则单文件会更难维护。

```ts
const sections = [
  { key: 'overview', label: '总览' },
  { key: 'tcp', label: 'TCP 控制面', children: [...] },
  { key: 'tdp', label: 'TDP 数据面' },
  { key: 'tdp-policy', label: 'TDP 策略中心' },
  { key: 'scene', label: '场景引擎' },
  ...
] as const
```

- [ ] **Step 5: 拆出最小可维护的策略中心组件，不把所有 UI 继续堆在 `App.tsx`**

在 `0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center/` 下新增 5 个组件：
- `GroupListPanel.tsx`：左侧 group 列表 + 状态 + priority + membershipVersion
- `GroupDetailPanel.tsx`：selector DSL、stats、命中 terminals、单 group recompute、编辑/删除按钮
- `PolicyListPanel.tsx`：policy 列表 + scope/topic/itemKey + enabled + group 过滤
- `PolicyEditorPanel.tsx`：创建/编辑 policy + validate + preview impact + delete
- `DecisionTracePanel.tsx`：terminal 最终真相与候选链

`App.tsx` 只负责组装与状态搬运：

```tsx
{activeKey === 'tdp-policy' ? (
  <Panel title="TDP 策略中心">
    <GroupListPanel
      groups={selectorGroups}
      selectedGroupId={selectedGroupId}
      onSelectGroup={setSelectedGroupId}
      onCreateGroup={...}
    />
    <GroupDetailPanel
      group={selectedGroup}
      membership={selectedTerminalMembership}
      onRecompute={...}
    />
    <PolicyListPanel
      policies={projectionPolicies}
      selectedPolicyId={selectedPolicyId}
      onSelectPolicy={setSelectedPolicyId}
    />
    <PolicyEditorPanel
      selectedPolicy={selectedPolicy}
      groups={selectorGroups}
      onPreviewImpact={...}
      onSubmit={...}
    />
    <DecisionTracePanel
      trace={selectedDecisionTrace}
      onSelectTopic={topicKey => loadTopicDecision(topicKey)}
      topicDecision={selectedTopicDecision}
    />
  </Panel>
) : null}
```

- [ ] **Step 6: 先用 `type-check` 验证 web 侧接口与组件编排**

Run: `corepack yarn workspace @next/mock-terminal-platform-web type-check`

Expected: PASS

- [ ] **Step 7: 再跑完整 web build，确认页面拆分没有引入打包错误**

Run: `corepack yarn workspace @next/mock-terminal-platform-web build`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/web/src/api.ts 0-mock-server/mock-terminal-platform/web/src/types.ts 0-mock-server/mock-terminal-platform/web/src/App.tsx 0-mock-server/mock-terminal-platform/web/src/components/tdp-policy-center
git commit -m "Add mock platform TDP policy center admin UI"
```

### Task 4: 在 `tdp-sync-runtime-v2` 接入 `GROUP` scope 与 membership 读取

**Files:**
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/state.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/tdpSync.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/topicChangePublisher.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/groupMembership.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/index.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/projectionStateHarness.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2.spec.ts`

- [ ] **Step 1: 先写 selector 级测试，锁定 `GROUP` scope 的解析顺序**

新增 `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/projectionStateHarness.ts`，再扩展 `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2.spec.ts`。这里显式补一个最小 helper，专门喂给 selector 测试用，不依赖仓库里不存在的旧 state seed helper。构造一组 `STORE`、`GROUP`、`TERMINAL` projection，验证最终 resolved projection 顺序为：
`PLATFORM < PROJECT < BRAND < TENANT < STORE < GROUP(rank ascending) < TERMINAL`。

```ts
it('resolves group scopes between store and terminal by membership rank', () => {
  const state = createProjectionStateHarness({
    terminalId: 'terminal_001',
    binding: {
      platformId: 'platform_001',
      projectId: 'project_001',
      brandId: 'brand_001',
      tenantId: 'tenant_001',
      storeId: 'store_001',
    },
    projections: [
      { topic: 'config.delta', scopeType: 'STORE', scopeId: 'store_001', itemKey: 'main', payload: { version: 'store' } },
      { topic: 'config.delta', scopeType: 'GROUP', scopeId: 'group_a', itemKey: 'main', payload: { version: 'group-a' } },
      { topic: 'config.delta', scopeType: 'GROUP', scopeId: 'group_b', itemKey: 'main', payload: { version: 'group-b' } },
      { topic: 'terminal.group.membership', scopeType: 'TERMINAL', scopeId: 'terminal_001', itemKey: 'terminal_001', payload: {
        membershipVersion: 2,
        groups: [
          { groupId: 'group_a', rank: 0, priority: 100, matchedBy: { projectId: 'project_001' } },
          { groupId: 'group_b', rank: 1, priority: 200, matchedBy: { templateId: 'template_001' } },
        ],
      } },
    ],
  })

  expect(selectTdpResolvedProjection(state, { topic: 'config.delta', itemKey: 'main' })?.payload.version).toBe('group-b')
})
```

- [ ] **Step 2: 扩展类型，允许终端保留 membership 结构化结果**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/state.ts` 增加 membership payload 类型；在 `types/protocol.ts` 扩展 scope type 文档，允许 `GROUP`。

```ts
export interface TdpTerminalGroupMembershipPayload {
  membershipVersion: number
  groups: Array<{
    groupId: string
    rank: number
    priority: number
    matchedBy: Record<string, string>
  }>
}
```

- [ ] **Step 3: 增加 membership selector，并把 `GROUP` 链插入现有 scope priority chain**

当前 `selectTdpResolvedProjectionByTopic()` 内部的 `buildScopePriorityChain()` 只认 `PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> TERMINAL`。把 `terminal.group.membership` 读取封装出来，再把 group 段插入 `STORE` 与 `TERMINAL` 之间。

补充约束：
- 终端只消费 membership 给出的 `rank` 顺序，不重新解释 `group.priority`
- 不要尝试把 group bucket 动态插入到 `STORE` 之前或 `TERMINAL` 之后

```ts
export const selectTerminalGroupMembership = (state: RootState) => {
  const terminalId = selectTcpTerminalId(state)
  if (!terminalId) return undefined
  return selectTdpResolvedProjection(state, {
    topic: 'terminal.group.membership',
    itemKey: terminalId,
  })?.payload as TdpTerminalGroupMembershipPayload | undefined
}

const buildScopePriorityChain = (state: RootState) => {
  const binding = selectTcpBindingSnapshot(state)
  const terminalId = selectTcpTerminalId(state)
  const groups = [...(selectTerminalGroupMembership(state)?.groups ?? [])].sort((left, right) => left.rank - right.rank)

  return [
    { scopeType: 'PLATFORM', scopeId: binding.platformId },
    { scopeType: 'PROJECT', scopeId: binding.projectId },
    { scopeType: 'BRAND', scopeId: binding.brandId },
    { scopeType: 'TENANT', scopeId: binding.tenantId },
    { scopeType: 'STORE', scopeId: binding.storeId },
    ...groups.map(group => ({ scopeType: 'GROUP' as const, scopeId: group.groupId })),
    { scopeType: 'TERMINAL', scopeId: terminalId },
  ].filter(item => Boolean(item.scopeId))
}
```

- [ ] **Step 4: 确保 topic-change publisher 会在 membership 更新时重算依赖 topic 的最终真相**

`topicChangePublisher.ts` 当前已经会枚举 projection 仓库中的全部 topic 并逐个比较 resolved fingerprint；这里先保持这个行为，不引入额外事件总线。要做的是补一条测试，明确 membership topic 变化后，依赖 topic 的 resolved result 会随 scope chain 变化而重算。

```ts
await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
  topic: 'terminal.group.membership',
  changes: [...],
}))
```

预期：后续 `config.delta` / `kernel.workflow.definition` 这些 topic 的 resolved result 会被重新计算，而不是只有 membership topic 自己发变化。

- [ ] **Step 5: 保持连接与恢复路径兼容，不新增 TDP 消息大类**

在 `sessionConnectionRuntime.ts` 只做兼容性校验，不改握手协议：
- snapshot / changes 仍按现有消息流
- `terminal.group.membership` 只是普通 projection topic
- 补充从 assembly/runtime 注入 runtime facts 到握手 payload 的设计占位，至少为后续 `assemblyAppId / bundleVersion / runtimeVersion / capabilities` 进入服务端预留字段

同时把新 selector 从 `index.ts` 导出：

```ts
export * from './selectors/groupMembership'
```

- [ ] **Step 6: 跑单包测试与类型检查**

Run: `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test`

Expected: PASS

Run: `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 type-check`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add 1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/state.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/tdpSync.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/topicChangePublisher.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/groupMembership.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/index.ts
git commit -m "Resolve TDP projections with dynamic group scope chain"
```

### Task 5: 用 live 场景验证 membership、group policy 与现有 workflow 消费链路

**Files:**
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-group-policy.spec.ts`
- Modify: `1-kernel/1.1-base/workflow-runtime-v2/test/helpers/liveHarness.ts`
- Modify: `1-kernel/1.1-base/workflow-runtime-v2/test/scenarios/workflow-runtime-v2-live-remote-definitions.spec.ts`

- [ ] **Step 1: 扩展 live harness，让测试可以直接操作 groups / policies / memberships**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts` 增加 admin helper，复用当前 `sandboxId` 注入风格：

```ts
admin: {
  ...existingAdmin,
  selectorGroups: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tdp/groups?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
  createSelectorGroup: (body: Record<string, unknown>) => fetchJson<any>(`${baseUrl}/api/v1/admin/tdp/groups`, {
    method: 'POST',
    body: JSON.stringify({ sandboxId: prepare.sandboxId, ...body }),
  }),
  recomputeGroupsByScope: (body: Record<string, unknown>) => fetchJson<any>(`${baseUrl}/api/v1/admin/tdp/groups/recompute-by-scope`, {
    method: 'POST',
    body: JSON.stringify({ sandboxId: prepare.sandboxId, ...body }),
  }),
  recomputeAllGroups: () => fetchJson<any>(`${baseUrl}/api/v1/admin/tdp/groups/recompute-all`, {
    method: 'POST',
    body: JSON.stringify({ sandboxId: prepare.sandboxId }),
  }),
  createProjectionPolicy: (body: Record<string, unknown>) => fetchJson<any>(`${baseUrl}/api/v1/admin/tdp/policies`, {
    method: 'POST',
    body: JSON.stringify({ sandboxId: prepare.sandboxId, ...body }),
  }),
  terminalGroupMemberships: (terminalId: string) => fetchJson<any>(`${baseUrl}/api/v1/admin/tdp/terminals/${terminalId}/memberships?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
}
```

- [ ] **Step 2: 新增 live 端到端场景，验证“策略先发布，终端后加入”仍能命中**

创建 `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-group-policy.spec.ts`：
1. 创建 group
2. 创建 `GROUP` scope policy
3. 再激活 terminal
4. 重算 membership
5. 连接 TDP
6. 断言 terminal 直接拿到 group policy，不需要重发

```ts
it('applies existing group policy to a terminal activated after policy publish', async () => {
  const platform = await createLivePlatform()
  const harness = createLiveRuntime({ baseUrl: platform.baseUrl })
  await harness.runtime.start()

  const group = await platform.admin.createSelectorGroup({
    groupCode: 'workflow-gray',
    name: 'Workflow Gray',
    priority: 200,
    selectorDslJson: { match: { templateId: ['template_kernel_pos'] } },
  })

  await platform.admin.createProjectionPolicy({
    topicKey: 'kernel.workflow.definition',
    itemKey: 'workflow.remote.gray',
    scopeType: 'GROUP',
    scopeKey: group.groupId,
    enabled: true,
    payloadJson: {
      definitionId: 'workflow.remote.gray',
      workflowKey: 'workflow.remote.gray',
      enabled: true,
      updatedAt: 1,
      rootStep: { stepKey: 'noop', type: 'command', input: { value: { commandName: 'noop', payload: {} } } },
    },
    description: 'gray workflow definition',
  })

  await activateLiveTerminal(harness.runtime, platform.prepare.sandboxId, '200000000008', 'device-live-tdp-group-001')
  const terminalId = selectTcpTerminalId(harness.runtime.getState())
  await platform.admin.recomputeGroupsByScope({ scopeType: 'TERMINAL', scopeKeys: [terminalId] })

  await harness.runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}), { requestId: createRequestId() })
  await waitFor(() => Boolean(selectTdpProjectionByTopicAndBucket(harness.runtime.getState(), {
    topic: 'kernel.workflow.definition',
    scopeType: 'GROUP',
    scopeId: group.groupId,
    itemKey: 'workflow.remote.gray',
  })), 10_000)
})
```

- [ ] **Step 3: 扩展 roundtrip / restart 场景，验证 membership topic 可在线推送且可重启恢复**

修改：
- `tdp-sync-runtime-v2-live-roundtrip.spec.ts`
- `tdp-sync-runtime-v2-live-restart-recovery.spec.ts`

新增断言：
1. `terminal.group.membership` topic 会出现在 snapshot / projection repository 中
2. membership 变化后 `lastCursor` 前进
3. 重启后先恢复旧 membership，再通过增量 changes 追到新 membershipVersion

- [ ] **Step 4: 让 workflow live 场景切到 group policy 验证，而不只测 terminal-scope projection**

在 `1-kernel/1.1-base/workflow-runtime-v2/test/scenarios/workflow-runtime-v2-live-remote-definitions.spec.ts` 新增一条场景，先创建 group policy，再连接 runtime，验证 `workflowRuntimeV2` 不需要知道 selector/group 细节，也能直接消费 resolved definition。

```ts
await waitFor(() => selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.gray').length === 1, 10_000)
```

核心断言：
- `workflow-runtime-v2` 仍只依赖 `tdpTopicDataChanged`
- 新增 `GROUP` scope 不会破坏原 terminal-scope 行为

- [ ] **Step 5: 运行最小必要验证命令，收集 fresh evidence**

Run: `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test tdp-sync-runtime-v2-live-group-policy.spec.ts`

Expected: PASS

Run: `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test tdp-sync-runtime-v2-live-roundtrip.spec.ts`

Expected: PASS

Run: `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 test tdp-sync-runtime-v2-live-restart-recovery.spec.ts`

Expected: PASS

Run: `corepack yarn workspace @next/kernel-base-workflow-runtime-v2 test workflow-runtime-v2-live-remote-definitions.spec.ts`

Expected: PASS

- [ ] **Step 6: 做最后一轮跨包类型检查**

Run: `corepack yarn workspace @next/mock-terminal-platform-server type-check`

Run: `corepack yarn workspace @next/mock-terminal-platform-web type-check`

Run: `corepack yarn workspace @next/kernel-base-tdp-sync-runtime-v2 type-check`

Run: `corepack yarn workspace @next/kernel-base-workflow-runtime-v2 type-check`

Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add 1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-group-policy.spec.ts 1-kernel/1.1-base/workflow-runtime-v2/test/helpers/liveHarness.ts 1-kernel/1.1-base/workflow-runtime-v2/test/scenarios/workflow-runtime-v2-live-remote-definitions.spec.ts
git commit -m "Verify dynamic group policy through TDP and workflow live scenarios"
```
