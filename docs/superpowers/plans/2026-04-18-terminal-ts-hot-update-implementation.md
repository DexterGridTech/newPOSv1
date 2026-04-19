# Terminal TS Hot Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `tdp-sync-runtime-v2`、`mock-terminal-platform`、`mixc-retail-assembly-rn84` 中分阶段落地终端 TS 热更新能力，先完成 desired 契约、本地状态机、主副屏同步、持久化恢复，再扩展到包管理、下载校验、assembly 启动选择、回滚和版本上报。

**Architecture:** 热更新命中层复用已落地的 Dynamic Group / Projection Policy：TCP 服务端通过 `terminal.hot-update.desired/main` 下发最终 desired，终端 TS 层只消费 resolved projection，不执行 selector。TS 层负责兼容性判定、状态机、主副屏协调、下载/安装编排；assembly 原生层负责 bundle resolver、boot marker、重启与启动健康检查；TCP 后台负责包管理、发布、版本历史与漂移观测。

**Tech Stack:** Express, React/Vite, Drizzle/SQLite, Redux Toolkit, Vitest, runtime-shell-v2, state-runtime, topology-runtime-v2, tdp-sync-runtime-v2, React Native 0.84 / Hermes, Kotlin `DefaultReactNativeHost`

---

## Scope and Order

本计划严格按 5 个切片执行，不能跳步：

1. **Slice 1：契约与本地判定**
2. **Slice 2：TCP 包管理与 desired 发布**
3. **Slice 3：下载、校验、解压、ready**
4. **Slice 4：assembly 启动选择与回滚**
5. **Slice 5：版本上报与后台观测**

依赖关系：

- Slice 2 的“终端收到 desired 并进入本地状态”依赖 Slice 1。
- Slice 3 依赖 Slice 1 的状态机和 Slice 2 的包下载接口。
- Slice 4 依赖 Slice 3 的 `ready` 状态和 Android Kotlin bundle resolver。
- Slice 5 的 drift/历史需要 Slice 1/4 已经产出完整版本事实上报。

---

## Implementation Invariants

- `terminal.hot-update.desired` 是唯一热更新 desired topic，第一版 `itemKey` 固定为 `main`。
- 终端不执行 selector DSL，只消费 resolved projection 与 `terminal.group.membership`。
- `runtimeVersion` 第一版必须完全相等，不做 semver range。
- 主屏是唯一下载者、唯一安装者、唯一写 `boot-marker.json` 的协调者；副屏只读。
- `hotUpdate` slice 必须声明 `syncIntent: 'master-to-slave'`，并提供显式 `sync` 描述。
- `storage_path` 只允许服务端内部使用，终端只能访问 TCP 生成的 `/download` URL。
- Android assembly 第一版必须通过 Kotlin 侧 bundle resolver 生效；TS 层不能假装自己能完成实际 bundle 切换。
- Slice 1 不实现真实下载；`download-pending` 在 Slice 1 是稳定等待态。
- 所有终端侧 API 请求继续沿用 `sandboxId` 作为硬隔离边界。

---

## File Map

### Slice 1: Terminal runtime contract and state machine

- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateTopic.ts`
  固定热更新 topic 常量、item key、schema version、状态枚举和基础 helper。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/hotUpdate.ts`
  放置 `HotUpdateCompatibility`、`TerminalHotUpdateDesiredV1`、`HotUpdateState`、`HotUpdateError`、`HotUpdateHistoryItem` 等类型。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/index.ts`
  导出 hot update 类型。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateCompatibility.ts`
  实现兼容性判定函数与 reject reason 归一化。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/tdpHotUpdate.ts`
  新增 `hotUpdate` slice、persist 规则、`syncIntent: 'master-to-slave'` 与 `sync` 描述。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/index.ts`
  注册 `tdpHotUpdate` slice 与 actions。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/hotUpdate.ts`
  导出 `selectTdpHotUpdateState`、`selectTdpHotUpdateDesired`、`selectTdpHotUpdateReady` 等 selector。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/index.ts`
  导出 hot update selector。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateProjectionReducer.ts`
  负责把 resolved desired topic 转换为本地 hot update state patch，不和 topicChangePublisher 混写。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/topicChangePublisher.ts`
  在 topic changed 发布后调用 hot update reconciler，或提供统一 hook 入口。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/index.ts`
  导出新类型、slice、selector、topic 常量。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts`
  单测兼容性判定。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-hot-update-state.spec.ts`
  单测 desired -> pending/rejected、撤销/paused/rollback 语义。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-hot-update-restart-recovery.spec.ts`
  live 测试持久化恢复。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-hot-update-master-slave-sync.spec.ts`
  live 测试主副屏 `master-to-slave` 同步和副屏只读语义。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/hotUpdateReadModelModule.ts`
  仅供主副屏 live 测试使用的最小 read-model module；职责是把 `tdpHotUpdate` slice 显式挂到 topology live harness，避免测试阶段临时拼装模块。

### Slice 2: TCP package control plane and desired release

- Modify: `0-mock-server/mock-terminal-platform/server/src/database/schema.ts`
  新增 `hot_update_packages`、`hot_update_releases`、`terminal_version_reports`。
- Modify: `0-mock-server/mock-terminal-platform/server/src/database/index.ts`
  初始化新表与索引。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateTypes.ts`
  热更新包、release、version report DTO。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateService.ts`
  上传解析、包列表、下载 URL、发布 desired；终端版本历史查询留到 Slice 5 的 `hotUpdateVersionReportService.ts`。
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`
  新增 hot update admin API 与 terminal version report API。
- Create: `0-mock-server/mock-terminal-platform/server/src/test/hot-update-api.spec.ts`
  覆盖上传、解析、下载 URL、desired 发布。
- Modify: `0-mock-server/mock-terminal-platform/web/src/api.ts`
  新增 hot update 请求封装。
- Modify: `0-mock-server/mock-terminal-platform/web/src/types.ts`
  新增 hot update 前端类型。
- Create: `0-mock-server/mock-terminal-platform/web/src/components/hot-update/*`
  包管理、发布策略、终端版本页。
- Modify: `0-mock-server/mock-terminal-platform/web/src/App.tsx`
  挂载热更新页面入口。
- Create: `scripts/release/package-hot-update.cjs`
  根脚本输出上传 zip 与 manifest。
- Modify: `package.json`
  注册 `release:hot-update:package`。

### Slice 3: Adapter download/install pipeline

- Modify: `1-kernel/1.1-base/platform-ports/src/types/ports.ts`
  增加 `HotUpdatePort`。
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`
  注入 `hotUpdate` port。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/hotUpdate.ts`
  assembly 侧 hot update port bridge。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/specs/hotUpdate.ts`
  RN Codegen spec。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/hotUpdate.ts`
  JS bridge。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/HotUpdateTurboModule.kt`
  Android 下载/校验/解压/boot marker helper。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/hotUpdateActor.ts`
  真实下载/ready 编排 actor。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/index.ts`
  注册 actor。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-hot-update-port.spec.ts`
  assembly bridge 单测。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-hot-update-ready.spec.ts`
  live 测试 desired -> ready。

### Slice 4: Assembly bundle resolver and rollback

- Modify: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/MainApplication.kt`
  覆写 `getJSBundleFile()` 或等价接口，读取 boot marker / ready bundle 路径。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/HotUpdateBundleResolver.kt`
  Android bundle resolver。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/HotUpdateBootMarkerStore.kt`
  原子写 boot marker。
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/reportAppLoadComplete.ts`
  接入 load-complete success report hook。
- Create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-hot-update-bundle-resolver.spec.ts`
  unit test for bundle resolver.
- Create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-hot-update-rollback.spec.ts`
  rollback test。

### Slice 5: Version reporting and observability

- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateService.ts`
  在 Slice 2 包管理 service（Task 2 先创建）上增加版本历史查询入口，不重新创建或覆盖该文件。
- Create: `0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateVersionReportService.ts`
  终端 version report 持久化、版本历史、drift 查询；与包上传/发布 service 分离，避免 Slice 5 覆盖 Slice 2。
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateVersionReporter.ts`
  runtime start / load complete / rollback report helper。
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/application/createModule.ts`
  安装 version reporter hook。
- Create: `0-mock-server/mock-terminal-platform/server/src/test/hot-update-version-report.spec.ts`
  server API tests。
- Modify: `0-mock-server/mock-terminal-platform/web/src/components/hot-update/*`
  在 Slice 2 已创建的热更新后台页面上增加版本历史、drift、异常页，不重新创建同一目录。

---

## Tasks

### Task 1: Slice 1 先落地热更新契约、兼容判定和本地状态机

**Files:**
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateTopic.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/hotUpdate.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/index.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateCompatibility.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/tdpHotUpdate.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/index.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/hotUpdate.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/index.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/index.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-hot-update-state.spec.ts`

- [ ] **Step 1: 先写兼容性失败测试，锁定 `runtimeVersion` / `appId` / `channel` / `rollback` 规则**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts` 新增如下测试：

```ts
import {describe, expect, it} from 'vitest'
import {
  evaluateHotUpdateCompatibility,
  type HotUpdateCompatibility,
} from '../../src'

const baseCurrent = {
  appId: 'assembly-android-mixc-retail-rn84',
  platform: 'android' as const,
  product: 'mixc-retail',
  runtimeVersion: 'android-mixc-retail-rn84@1.0',
  assemblyVersion: '1.0.0',
  buildNumber: 1,
  channel: 'development',
  capabilities: ['projection-mirror', 'dispatch-relay', 'state-sync'],
}

const baseCompatibility: HotUpdateCompatibility = {
  appId: 'assembly-android-mixc-retail-rn84',
  platform: 'android',
  product: 'mixc-retail',
  runtimeVersion: 'android-mixc-retail-rn84@1.0',
}

describe('tdp hot update compatibility', () => {
  it('accepts exact runtimeVersion match', () => {
    expect(evaluateHotUpdateCompatibility({
      current: baseCurrent,
      compatibility: baseCompatibility,
      desiredBundleVersion: '1.0.0+ota.1',
      currentBundleVersion: '1.0.0+ota.0',
    })).toMatchObject({ok: true})
  })

  it('rejects runtimeVersion mismatch', () => {
    expect(evaluateHotUpdateCompatibility({
      current: baseCurrent,
      compatibility: {
        ...baseCompatibility,
        runtimeVersion: 'android-mixc-retail-rn84@2.0',
      },
      desiredBundleVersion: '1.0.0+ota.1',
      currentBundleVersion: '1.0.0+ota.0',
    })).toMatchObject({
      ok: false,
      reason: 'RUNTIME_VERSION_MISMATCH',
    })
  })

  it('rejects downgrade unless rollback explicitly allowed', () => {
    expect(evaluateHotUpdateCompatibility({
      current: baseCurrent,
      compatibility: baseCompatibility,
      desiredBundleVersion: '1.0.0+ota.0',
      currentBundleVersion: '1.0.0+ota.2',
      rolloutMode: 'active',
      allowDowngrade: false,
    })).toMatchObject({
      ok: false,
      reason: 'DOWNGRADE_NOT_ALLOWED',
    })
  })
})
```

- [ ] **Step 2: 运行聚焦单测，确认现在失败**

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts`

Expected: FAIL，提示 `evaluateHotUpdateCompatibility` 和 hot update 类型尚不存在。

- [ ] **Step 3: 增加 hot update 常量与类型定义，不引入下载细节**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateTopic.ts` 写入：

```ts
export const TDP_HOT_UPDATE_TOPIC = 'terminal.hot-update.desired'
export const TDP_HOT_UPDATE_ITEM_KEY = 'main'
export const TDP_HOT_UPDATE_SCHEMA_VERSION = 1

export const HOT_UPDATE_REJECT_REASONS = {
  appIdMismatch: 'APP_ID_MISMATCH',
  platformMismatch: 'PLATFORM_MISMATCH',
  productMismatch: 'PRODUCT_MISMATCH',
  runtimeVersionMismatch: 'RUNTIME_VERSION_MISMATCH',
  assemblyVersionOutOfRange: 'ASSEMBLY_VERSION_OUT_OF_RANGE',
  buildNumberOutOfRange: 'BUILD_NUMBER_OUT_OF_RANGE',
  channelNotAllowed: 'CHANNEL_NOT_ALLOWED',
  missingCapability: 'MISSING_CAPABILITY',
  forbiddenCapability: 'FORBIDDEN_CAPABILITY',
  downgradeNotAllowed: 'DOWNGRADE_NOT_ALLOWED',
} as const
```

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/hotUpdate.ts` 写入 Slice 1 需要的最小类型：

```ts
export interface HotUpdateCompatibility {
  appId: string
  platform: 'android' | 'electron'
  product: string
  runtimeVersion: string
  minAssemblyVersion?: string
  maxAssemblyVersion?: string
  minBuildNumber?: number
  maxBuildNumber?: number
  allowedChannels?: string[]
  requiredCapabilities?: string[]
  forbiddenCapabilities?: string[]
  targetPackages?: Record<string, string>
}

export interface TerminalHotUpdateDesiredV1 {
  schemaVersion: 1
  releaseId: string
  packageId: string
  appId: string
  platform: 'android' | 'electron'
  product: string
  bundleVersion: string
  runtimeVersion: string
  packageUrl: string
  packageSize: number
  packageSha256: string
  manifestSha256: string
  compatibility: HotUpdateCompatibility
  restart: {
    mode: 'immediate' | 'idle' | 'next-launch' | 'manual'
    graceMs?: number
    idleWindowMs?: number
    deadlineAt?: string
    operatorInstruction?: string
  }
  rollout: {
    mode: 'active' | 'paused' | 'rollback'
    publishedAt: string
    expiresAt?: string
    allowDowngrade?: boolean
  }
  safety: {
    requireSignature: boolean
    maxDownloadAttempts: number
    maxLaunchFailures: number
    healthCheckTimeoutMs: number
  }
  metadata?: {
    releaseNotes?: string[]
    operator?: string
    reason?: string
  }
}

export interface HotUpdateCurrentFacts {
  appId: string
  platform: 'android' | 'electron'
  product: string
  runtimeVersion: string
  assemblyVersion: string
  buildNumber: number
  channel?: string
  capabilities: string[]
}

export type HotUpdateCandidateStatus =
  | 'desired-received'
  | 'compatibility-rejected'
  | 'download-pending'
  | 'failed'

export interface HotUpdateCandidateState {
  releaseId: string
  packageId: string
  bundleVersion: string
  status: HotUpdateCandidateStatus
  attempts: number
  reason?: string
  updatedAt: number
}

export interface HotUpdateAppliedVersion {
  source: 'embedded' | 'hot-update' | 'rollback'
  appId: string
  assemblyVersion: string
  buildNumber: number
  runtimeVersion: string
  bundleVersion: string
  packageId?: string
  releaseId?: string
  installDir?: string
  appliedAt: number
}

export interface HotUpdateHistoryItem {
  event:
    | 'desired-received'
    | 'compatibility-rejected'
    | 'download-pending'
    | 'desired-cleared'
    | 'paused'
    | 'package-pruned'
  releaseId?: string
  packageId?: string
  bundleVersion?: string
  reason?: string
  at: number
}

export interface HotUpdateState {
  current: HotUpdateAppliedVersion
  desired?: TerminalHotUpdateDesiredV1
  candidate?: HotUpdateCandidateState
  // Slice 3 will add ready?: HotUpdateReadyState.
  // Slice 4 will add applying?: HotUpdateApplyingState.
  previous?: HotUpdateAppliedVersion
  history: HotUpdateHistoryItem[]
  lastError?: {code: string; message: string; at: number}
}
```

并在 `src/types/index.ts`、`src/index.ts` 导出。

- [ ] **Step 4: 实现兼容性判定函数，并确保不引入外部依赖**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateCompatibility.ts` 写入：

```ts
import type {HotUpdateCompatibility, HotUpdateCurrentFacts} from '../types'
import {HOT_UPDATE_REJECT_REASONS} from './hotUpdateTopic'

const compareVersion = (left: string, right: string): number => {
  const normalize = (value: string) => value.split('+')[0]?.split('.').map(part => Number(part) || 0) ?? []
  const leftParts = normalize(left)
  const rightParts = normalize(right)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (delta !== 0) {
      return delta
    }
  }
  return 0
}

export const evaluateHotUpdateCompatibility = (input: {
  current: HotUpdateCurrentFacts
  compatibility: HotUpdateCompatibility
  desiredBundleVersion: string
  currentBundleVersion: string
  rolloutMode?: 'active' | 'paused' | 'rollback'
  allowDowngrade?: boolean
}) => {
  const {current, compatibility} = input
  if (compatibility.appId !== current.appId) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.appIdMismatch}
  }
  if (compatibility.platform !== current.platform) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.platformMismatch}
  }
  if (compatibility.product !== current.product) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.productMismatch}
  }
  if (compatibility.runtimeVersion !== current.runtimeVersion) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.runtimeVersionMismatch}
  }
  if (compatibility.minAssemblyVersion && compareVersion(current.assemblyVersion, compatibility.minAssemblyVersion) < 0) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.assemblyVersionOutOfRange}
  }
  if (compatibility.maxAssemblyVersion && compareVersion(current.assemblyVersion, compatibility.maxAssemblyVersion) > 0) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.assemblyVersionOutOfRange}
  }
  if (compatibility.minBuildNumber != null && current.buildNumber < compatibility.minBuildNumber) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.buildNumberOutOfRange}
  }
  if (compatibility.maxBuildNumber != null && current.buildNumber > compatibility.maxBuildNumber) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.buildNumberOutOfRange}
  }
  if (compatibility.allowedChannels?.length && (!current.channel || !compatibility.allowedChannels.includes(current.channel))) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.channelNotAllowed}
  }
  if (compatibility.requiredCapabilities?.some(item => !current.capabilities.includes(item))) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.missingCapability}
  }
  if (compatibility.forbiddenCapabilities?.some(item => current.capabilities.includes(item))) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.forbiddenCapability}
  }
  const downgrade = compareVersion(input.desiredBundleVersion, input.currentBundleVersion) < 0
  if (downgrade && !(input.rolloutMode === 'rollback' && input.allowDowngrade === true)) {
    return {ok: false as const, reason: HOT_UPDATE_REJECT_REASONS.downgradeNotAllowed}
  }
  return {ok: true as const}
}
```

约束：`HOT_UPDATE_REJECT_REASONS` 的 key/value 必须与 `HotUpdateCompatibility` reject reason 字符串一一对应；后续增加 reason 时要同时更新常量、兼容性测试和状态机历史断言。

- [ ] **Step 5: 运行聚焦单测，确认兼容性函数通过**

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts`

Expected: PASS

- [ ] **Step 6: 写状态机失败测试，锁定 desired / paused / revoke / rollback 语义**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-hot-update-state.spec.ts` 新增：

```ts
import {describe, expect, it} from 'vitest'
import {configureStore} from '@reduxjs/toolkit'
import {
  createTdpHotUpdateStateForTests,
  reduceHotUpdateDesired,
  TDP_HOT_UPDATE_ITEM_KEY,
  TDP_HOT_UPDATE_TOPIC,
} from '../../src'

const baseDesired = {
  schemaVersion: 1,
  releaseId: 'release-001',
  packageId: 'package-001',
  appId: 'assembly-android-mixc-retail-rn84',
  platform: 'android',
  product: 'mixc-retail',
  bundleVersion: '1.0.0+ota.1',
  runtimeVersion: 'android-mixc-retail-rn84@1.0',
  packageUrl: 'http://mock/hot-update.zip',
  packageSize: 1,
  packageSha256: 'abc',
  manifestSha256: 'def',
  compatibility: {
    appId: 'assembly-android-mixc-retail-rn84',
    platform: 'android',
    product: 'mixc-retail',
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
  },
  restart: {mode: 'idle', idleWindowMs: 60_000},
  rollout: {mode: 'active', publishedAt: '2026-04-18T00:00:00.000Z'},
  safety: {requireSignature: false, maxDownloadAttempts: 3, maxLaunchFailures: 2, healthCheckTimeoutMs: 5_000},
}

describe('tdp hot update state reducer', () => {
  it('moves compatible desired into download-pending', () => {
    const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests(), {
      desired: baseDesired,
      currentFacts: {
        appId: 'assembly-android-mixc-retail-rn84',
        platform: 'android',
        product: 'mixc-retail',
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        channel: 'development',
        capabilities: [],
      },
      now: 100,
    })

    expect(state.candidate).toMatchObject({
      status: 'download-pending',
      releaseId: 'release-001',
      packageId: 'package-001',
    })
  })

  it('records paused event without starting a new download when rollout is paused', () => {
    const paused = reduceHotUpdateDesired(createTdpHotUpdateStateForTests(), {
      desired: {
        ...baseDesired,
        rollout: {mode: 'paused', publishedAt: '2026-04-18T00:00:00.000Z'},
      },
      currentFacts: {
        appId: 'assembly-android-mixc-retail-rn84',
        platform: 'android',
        product: 'mixc-retail',
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        channel: 'development',
        capabilities: [],
      },
      now: 150,
    })

    expect(paused.candidate).toBeUndefined()
    expect(paused.history.at(-1)).toMatchObject({
      event: 'paused',
      releaseId: 'release-001',
      packageId: 'package-001',
    })
  })

  it('clears candidate when desired is removed', () => {
    const next = reduceHotUpdateDesired(createTdpHotUpdateStateForTests({
      candidate: {
        releaseId: 'release-001',
        packageId: 'package-001',
        bundleVersion: '1.0.0+ota.1',
        status: 'download-pending',
        attempts: 0,
        updatedAt: 1,
      },
    }), {
      desired: undefined,
      currentFacts: {
        appId: 'assembly-android-mixc-retail-rn84',
        platform: 'android',
        product: 'mixc-retail',
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        capabilities: [],
      },
      now: 200,
    })

    expect(next.candidate).toBeUndefined()
    expect(next.history.at(-1)?.event).toBe('desired-cleared')
  })
})
```

- [ ] **Step 7: 实现 `tdpHotUpdate` slice 与纯 reducer helper，保持 Slice 1 不依赖 runtime actor**

在 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/tdpHotUpdate.ts` 实现：

- `initialState.current` 默认从 embedded bundle 构造；测试 helper 可通过 `overrides.current` 覆盖 `appId` / `platform` / `runtimeVersion`，用于 Electron 或其他 assembly 测试。
- `syncIntent: 'master-to-slave'` 必须在 Slice 1 同步落地，不能推迟到主副屏测试阶段。
- `sync.kind = 'record'`，只同步 `desired`、`candidate`、`current`、`lastError` 的摘要；`history` 持久化但不参与主副屏同步，避免副屏历史噪声反向传播。
- `persistence` 至少对 `current`、`desired`、`candidate`、`history` 做 `immediate` 持久化。
- 提供 `createTdpHotUpdateStateForTests()` 和完整可通过测试的 `reduceHotUpdateDesired()`；此步骤不是空骨架，不能保留 `return state`。

建议代码骨架：

```ts
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
  HotUpdateCurrentFacts,
  HotUpdateHistoryItem,
  HotUpdateState,
  TerminalHotUpdateDesiredV1,
} from '../../types'
import {evaluateHotUpdateCompatibility} from '../../foundations/hotUpdateCompatibility'

export const TDP_HOT_UPDATE_STATE_KEY = 'kernel.base.tdp-sync-runtime-v2.hot-update'

export const createTdpHotUpdateStateForTests = (overrides: Partial<HotUpdateState> = {}): HotUpdateState => ({
  current: {
    source: 'embedded',
    appId: 'assembly-android-mixc-retail-rn84',
    assemblyVersion: '1.0.0',
    buildNumber: 1,
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    bundleVersion: '1.0.0+ota.0',
    appliedAt: 0,
  },
  history: [],
  ...overrides,
})

const appendHistory = (state: HotUpdateState, item: HotUpdateHistoryItem): HotUpdateHistoryItem[] => [
  ...state.history.slice(-49),
  item,
]

export const reduceHotUpdateDesired = (
  state: HotUpdateState,
  input: {
    desired?: TerminalHotUpdateDesiredV1
    currentFacts: HotUpdateCurrentFacts
    now: number
  },
): HotUpdateState => {
  if (!input.desired) {
    if (!state.desired && !state.candidate) {
      return state
    }
    return {
      ...state,
      desired: undefined,
      candidate: undefined,
      history: appendHistory(state, {
        event: 'desired-cleared',
        releaseId: state.desired?.releaseId ?? state.candidate?.releaseId,
        packageId: state.desired?.packageId ?? state.candidate?.packageId,
        bundleVersion: state.desired?.bundleVersion ?? state.candidate?.bundleVersion,
        at: input.now,
      }),
    }
  }

  const desired = input.desired
  if (desired.rollout.mode === 'paused') {
    return {
      ...state,
      desired,
      candidate: undefined,
      history: appendHistory(state, {
        event: 'paused',
        releaseId: desired.releaseId,
        packageId: desired.packageId,
        bundleVersion: desired.bundleVersion,
        at: input.now,
      }),
    }
  }

  const compatibility = evaluateHotUpdateCompatibility({
    current: input.currentFacts,
    compatibility: desired.compatibility,
    desiredBundleVersion: desired.bundleVersion,
    currentBundleVersion: state.current.bundleVersion,
    rolloutMode: desired.rollout.mode,
    allowDowngrade: desired.rollout.allowDowngrade,
  })

  if (!compatibility.ok) {
    return {
      ...state,
      desired,
      candidate: {
        releaseId: desired.releaseId,
        packageId: desired.packageId,
        bundleVersion: desired.bundleVersion,
        status: 'compatibility-rejected',
        attempts: state.candidate?.packageId === desired.packageId ? state.candidate.attempts : 0,
        reason: compatibility.reason,
        updatedAt: input.now,
      },
      history: appendHistory(state, {
        event: 'compatibility-rejected',
        releaseId: desired.releaseId,
        packageId: desired.packageId,
        bundleVersion: desired.bundleVersion,
        reason: compatibility.reason,
        at: input.now,
      }),
    }
  }

  return {
    ...state,
    desired,
    candidate: {
      releaseId: desired.releaseId,
      packageId: desired.packageId,
      bundleVersion: desired.bundleVersion,
      status: 'download-pending',
      attempts: state.candidate?.packageId === desired.packageId ? state.candidate.attempts : 0,
      updatedAt: input.now,
    },
    history: appendHistory(state, {
      event: 'download-pending',
      releaseId: desired.releaseId,
      packageId: desired.packageId,
      bundleVersion: desired.bundleVersion,
      at: input.now,
    }),
  }
}

export const tdpHotUpdateSliceDescriptor: StateRuntimeSliceDescriptor<HotUpdateState> = {
  name: TDP_HOT_UPDATE_STATE_KEY,
  reducer: tdpHotUpdateSlice.reducer,
  actions: tdpHotUpdateActions,
  persistIntent: 'owner-only',
  persistence: {
    kind: 'record',
    storageKeyPrefix: TDP_HOT_UPDATE_STATE_KEY,
    flushMode: 'immediate',
    getEntries: state => ({
      current: state.current,
      desired: state.desired,
      candidate: state.candidate,
      history: state.history,
      previous: state.previous,
      lastError: state.lastError,
    }),
  },
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: state => ({
      current: {value: state.current, updatedAt: state.current.appliedAt},
      desired: state.desired
        ? {value: state.desired, updatedAt: Date.parse(state.desired.rollout.publishedAt) || 0}
        : undefined,
      candidate: state.candidate
        ? {value: state.candidate, updatedAt: state.candidate.updatedAt}
        : undefined,
      lastError: state.lastError
        ? {value: state.lastError, updatedAt: state.lastError.at}
        : undefined,
    }),
    applyEntries: entries => ({
      current: entries.current?.value,
      desired: entries.desired?.value,
      candidate: entries.candidate?.value,
      lastError: entries.lastError?.value,
    }),
  },
}
```

- [ ] **Step 8: 注册 slice、selectors 和 exports，保证业务包可直接读取**

在以下文件补齐导出：

- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/index.ts`
- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/hotUpdate.ts`
- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/index.ts`
- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/index.ts`

`selectors/hotUpdate.ts` 至少包含：

```ts
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {TDP_HOT_UPDATE_STATE_KEY} from '../features/slices/tdpHotUpdate'
import type {HotUpdateState} from '../types'

export const selectTdpHotUpdateState = (state: RootState) =>
  state[TDP_HOT_UPDATE_STATE_KEY as keyof RootState] as HotUpdateState | undefined

export const selectTdpHotUpdateDesired = (state: RootState) =>
  selectTdpHotUpdateState(state)?.desired

export const selectTdpHotUpdateCandidate = (state: RootState) =>
  selectTdpHotUpdateState(state)?.candidate
```

- [ ] **Step 9: 运行 Slice 1 的单元测试与 type-check**

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts test/scenarios/tdp-sync-runtime-v2-hot-update-state.spec.ts`

Expected: PASS

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`

Expected: PASS

### Task 2: Slice 1 接入 resolved desired 监听和 persistence/restart recovery

**Files:**
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateProjectionReducer.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/topicChangePublisher.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-hot-update-restart-recovery.spec.ts`

- [ ] **Step 1: 写 live 失败测试，锁定 projection -> pending 与真实重启恢复**

在 `tdp-sync-runtime-v2-live-hot-update-restart-recovery.spec.ts` 复用现有 `createLivePlatform()` 和 `createLiveRuntime()`，测试流程：

1. 激活终端并连接 TDP。
2. 服务端 upsert 一条 `terminal.hot-update.desired` terminal-scope projection。
3. 等待 runtime 进入 `download-pending`。
4. `flushPersistence()` 后销毁 runtime。
5. 用同一 storage 创建第二个 runtime。
6. 断言 `candidate.status === 'download-pending'`，且 `desired.packageId` 恢复。

测试骨架：

```ts
it('rehydrates hot update desired and pending candidate after real restart', async () => {
  const platform = await createLivePlatform()
  const storagePair = createLiveFileStoragePair('tdp-hot-update-restart')
  // createLiveFileStoragePair() returns { stateStorage: {storage}, secureStateStorage: {storage} },
  // which matches createLiveRuntime() parameters and allows the second runtime to rehydrate the first runtime's persisted state.

  const firstRuntimeHarness = createLiveRuntime({
    baseUrl: platform.baseUrl,
    localNodeId: 'node_hot_update_restart',
    stateStorage: storagePair.stateStorage,
    secureStateStorage: storagePair.secureStateStorage,
  })

  await firstRuntimeHarness.runtime.start()
  await activateLiveTerminal(firstRuntimeHarness.runtime, platform.prepare.sandboxId, '200000000001', 'device-hot-update-restart-001')
  await firstRuntimeHarness.runtime.dispatchCommand(
    createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
    {requestId: createRequestId()},
  )

  await waitFor(() => selectTdpSessionState(firstRuntimeHarness.runtime.getState())?.status === 'READY', 10_000)

  const terminalId = selectTcpTerminalId(firstRuntimeHarness.runtime.getState())
  await platform.admin.upsertProjection({
    topicKey: 'terminal.hot-update.desired',
    scopeType: 'TERMINAL',
    scopeKey: terminalId,
    itemKey: 'main',
    payload: {
      schemaVersion: 1,
      releaseId: 'release-live-001',
      packageId: 'package-live-001',
      appId: 'assembly-android-mixc-retail-rn84',
      platform: 'android',
      product: 'mixc-retail',
      bundleVersion: '1.0.0+ota.1',
      runtimeVersion: 'android-mixc-retail-rn84@1.0',
      packageUrl: 'http://mock/hot-update.zip',
      packageSize: 1,
      packageSha256: 'abc',
      manifestSha256: 'def',
      compatibility: {
        appId: 'assembly-android-mixc-retail-rn84',
        platform: 'android',
        product: 'mixc-retail',
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
      },
      restart: {mode: 'idle', idleWindowMs: 60_000},
      rollout: {mode: 'active', publishedAt: '2026-04-18T00:00:00.000Z'},
      safety: {requireSignature: false, maxDownloadAttempts: 3, maxLaunchFailures: 2, healthCheckTimeoutMs: 5_000},
    },
  })

  await waitFor(() => selectTdpHotUpdateCandidate(firstRuntimeHarness.runtime.getState())?.status === 'download-pending', 10_000)
  await firstRuntimeHarness.runtime.flushPersistence()

  const secondRuntimeHarness = createLiveRuntime({
    baseUrl: platform.baseUrl,
    localNodeId: 'node_hot_update_restart',
    stateStorage: storagePair.stateStorage,
    secureStateStorage: storagePair.secureStateStorage,
  })
  await secondRuntimeHarness.runtime.start()

  expect(selectTdpHotUpdateCandidate(secondRuntimeHarness.runtime.getState())).toMatchObject({
    status: 'download-pending',
    packageId: 'package-live-001',
  })
})
```

- [ ] **Step 2: 在 topic change publisher 后接 hot update reconcile，避免直接耦合 actor**

在 `hotUpdateProjectionReducer.ts` 提供：

```ts
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTdpResolvedProjection} from '../selectors'
import {tdpHotUpdateActions} from '../features/slices/tdpHotUpdate'
import {TDP_HOT_UPDATE_ITEM_KEY, TDP_HOT_UPDATE_TOPIC} from './hotUpdateTopic'

export const reconcileHotUpdateDesiredFromResolvedProjection = async (runtime: Pick<KernelRuntimeV2, 'getState' | 'getStore'>) => {
  const state = runtime.getState() as any
  const desired = selectTdpResolvedProjection(state, {
    topic: TDP_HOT_UPDATE_TOPIC,
    itemKey: TDP_HOT_UPDATE_ITEM_KEY,
  })?.payload as TerminalHotUpdateDesiredV1 | undefined
  runtime.getStore().dispatch(tdpHotUpdateActions.reconcileDesired({ desired }))
}
```

`topicChangePublisher.ts` 当前 `publishTopicDataChangesV2(runtime, fingerprintRef)` 已接收 `runtime` 参数，并在 topic loop 内维护 `changedTopics`。保持现有 topic loop 和 `tdpTopicDataChanged` 广播不变，只在 loop 完成后、`return {changedTopicCount, changedTopics}` 之前追加 reconcile：

```ts
export const publishTopicDataChangesV2 = async (
  runtime: {
    getState(): unknown
    getStore(): {dispatch(action: unknown): unknown}
    dispatchCommand<TPayload = unknown>(command: ReturnType<typeof createCommand<TPayload>>): Promise<unknown>
  },
  fingerprintRef: TopicChangePublisherFingerprintV2,
): Promise<{changedTopicCount: number; changedTopics: string[]}> => {
  const state = runtime.getState() as any
  const topics = new Set<string>([
    ...Object.values(selectTdpProjectionState(state) ?? {}).map(item => item.topic),
    ...Object.keys(fingerprintRef.byTopic),
  ])
  const changedTopics: string[] = []

  for (const topic of topics) {
    // 保留现有 fingerprint、changes、tdpTopicDataChanged 逻辑。
  }

  if (changedTopics.includes(TDP_HOT_UPDATE_TOPIC) || changedTopics.includes('terminal.group.membership')) {
    await reconcileHotUpdateDesiredFromResolvedProjection(runtime)
  }

  return {
    changedTopicCount: changedTopics.length,
    changedTopics,
  }
}
```

这样 membership 变化导致 winner 改变时，hot update desired 也会被重新归并。

- [ ] **Step 3: 让 `tdpHotUpdate` slice 的 action 自己读取当前 runtime facts 参数，而不是硬编码测试值**

为避免 Slice 1 卡在 assembly 注入，先在 `tdpHotUpdate` 中提供一个 action：

```ts
reconcileDesired(state, action: PayloadAction<{
  desired?: TerminalHotUpdateDesiredV1
  currentFacts?: HotUpdateCurrentFacts
  now?: number
}>)
```

如果 `currentFacts` 未提供，先从 `state.current` 推导最小事实；推导规则固定为：`channel: undefined`（不声明任何 channel）、`capabilities: []`（不声明任何额外能力）。这保证 live 测试可以工作，同时不会伪造终端能力。真正的 assembly runtime facts 注入放到 Slice 5 再增强。

- [ ] **Step 4: 运行 live restart recovery 测试与 type-check**

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-live-hot-update-restart-recovery.spec.ts`

Expected: PASS

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`

Expected: PASS

### Task 3: Slice 1 补主副屏同步和副屏只读约束

**Files:**
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-hot-update-master-slave-sync.spec.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/tdpHotUpdate.ts`（Task 1 创建后在本任务补同步细化）
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/hotUpdateReadModelModule.ts`

- [ ] **Step 1: 写 master-to-slave live 测试，锁定主副屏同版本约束在 Slice 1 的最小表现**

测试目标：主屏收到 desired 后进入 `download-pending`；副屏通过 topology state sync 收到同样的 `desired` 和 `candidate.status`；副屏不会因为同步而产生独立 `attempts` 增长或本地执行痕迹。

Run path 参考：`topology-runtime-v2-live-state-sync-master-to-slave.spec.ts`。

测试关键断言：

```ts
expect(selectTdpHotUpdateCandidate(masterRuntime.getState())).toMatchObject({
  status: 'download-pending',
  packageId: 'package-master-001',
})
expect(selectTdpHotUpdateCandidate(slaveRuntime.getState())).toMatchObject({
  status: 'download-pending',
  packageId: 'package-master-001',
})
expect(selectTdpHotUpdateCandidate(slaveRuntime.getState())?.attempts).toBe(0)
```

- [ ] **Step 2: 固化 `hotUpdate` slice 的摘要同步实现，避免历史噪声把 diff 搞大**

把 `tdpHotUpdate.ts` 的 sync descriptor 固化为如下完整实现，并在主副屏测试里确认副屏只接收摘要态，不接收历史噪声：

```ts
sync: {
  kind: 'record',
  getEntries: state => ({
    current: {value: state.current, updatedAt: state.current.appliedAt},
    desired: state.desired
      ? {value: state.desired, updatedAt: Date.parse(state.desired.rollout.publishedAt) || 0}
      : undefined,
    candidate: state.candidate
      ? {value: state.candidate, updatedAt: state.candidate.updatedAt}
      : undefined,
    lastError: state.lastError
      ? {value: state.lastError, updatedAt: state.lastError.at}
      : undefined,
  }),
  applyEntries: entries => ({
    current: entries.current?.value,
    desired: entries.desired?.value,
    candidate: entries.candidate?.value,
    lastError: entries.lastError?.value,
  }),
}
```

`history` 继续本地持久化，但不参与主副屏同步，避免副屏成为噪声传播者。

- [ ] **Step 3: 运行主副屏同步测试**

Run: `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-live-hot-update-master-slave-sync.spec.ts`

Expected: PASS

### Task 4: 产出 Slice 1 完整验证证据并更新文档

**Files:**
- Modify: `docs/superpowers/specs/2026-04-18-terminal-ts-hot-update-design.md`
- Modify: `docs/superpowers/plans/2026-04-18-terminal-ts-hot-update-implementation.md`

- [ ] **Step 1: 运行 Slice 1 全量命令，收集最终证据**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test \
  test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts \
  test/scenarios/tdp-sync-runtime-v2-hot-update-state.spec.ts \
  test/scenarios/tdp-sync-runtime-v2-live-hot-update-restart-recovery.spec.ts \
  test/scenarios/tdp-sync-runtime-v2-live-hot-update-master-slave-sync.spec.ts
corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check
```

Expected: 全部 PASS

- [ ] **Step 2: 回写计划执行状态和设计文档的 Slice 1 完成说明**

在本计划顶部增加 `Execution Status`，记录 Slice 1 已完成项和验证命令；在设计文档 `docs/superpowers/specs/2026-04-18-terminal-ts-hot-update-design.md` 的 `15. 最小落地切片` 下补一段 `Slice 1 implementation notes`，明确：

- 已落地的状态字段：`current`、`desired`、`candidate`、`previous`、`history`、`lastError`。
- 尚未落地的能力：真实下载、签名校验、解压、`ready`、`applying`、重启策略执行、启动健康确认、自动回滚。
- 主副屏同步当前只同步摘要状态：`current`、`desired`、`candidate`、`lastError`；`history` 只做本地持久化，不参与 state sync。
- 与设计偏差：如 Slice 1 无偏差，写 `none`；如为测试增加 helper，写明 helper 不进入生产 bundle。

- [ ] **Step 3: 手工检查计划与设计的一致性，再交 review**

检查以下点并修正任何偏差：

- 计划中的 topic 名是否始终为 `terminal.hot-update.desired`
- `itemKey` 是否始终为 `main`
- `runtimeVersion` 是否始终是 exact match
- 主副屏同步是否始终是 `master-to-slave`
- Slice 1 是否没有偷偷引入真实下载实现

---

## Verification Commands by Slice

### Slice 1

- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-hot-update-compatibility.spec.ts`
- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-hot-update-state.spec.ts`
- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-live-hot-update-restart-recovery.spec.ts`
- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-live-hot-update-master-slave-sync.spec.ts`
- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`

### Slice 2

- `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/hot-update-api.spec.ts`
- `corepack yarn workspace @impos2/mock-terminal-platform-server type-check`
- `corepack yarn workspace @impos2/mock-terminal-platform-web type-check`
- `corepack yarn workspace @impos2/mock-terminal-platform-web build`

### Slice 3

- `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-hot-update-port.spec.ts`
- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test test/scenarios/tdp-sync-runtime-v2-live-hot-update-ready.spec.ts`
- `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 type-check`
- `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`

### Slice 4

- `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-hot-update-bundle-resolver.spec.ts`
- `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-hot-update-rollback.spec.ts`
- `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 type-check`

### Slice 5

- `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/hot-update-version-report.spec.ts`
- `corepack yarn workspace @impos2/mock-terminal-platform-server type-check`
- `corepack yarn workspace @impos2/mock-terminal-platform-web type-check`
- `corepack yarn workspace @impos2/mock-terminal-platform-web build`

---

## Risks to Watch During Execution

- `topicChangePublisher.ts` 当前是通用 resolved-topic 广播路径；改动时不要破坏 error/message 和 system.parameter 的现有行为。
- `tdp-sync-runtime-v2` 目前没有现成业务 actor 模式可直接复用 hot update state reconcile；Slice 1 先用纯 reducer + publisher hook，避免过早引入副作用 actor。
- live harness 当前只有单 runtime 和 TDP 平台 helper；主副屏同步测试需要复用 topology live harness，而不是硬拼 mock。
- Android bundle resolver 必须由 Kotlin 改造配合；如果只改 TS，Slice 4 无法真正完成。
- Electron 不是第一阶段强制验证目标，不要在 Slice 1-4 为了“平台统一”过度设计。
