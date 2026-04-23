# Terminal TS Hot Update Design

> 日期：2026-04-18  
> 范围：终端 TS 层热更新、TCP 管理后台、TDP desired projection、4-assembly 启动与回滚协同  
> 依赖基础：`docs/superpowers/specs/2026-04-18-tdp-dynamic-group-policy-design.md` 已落地的 Dynamic Group / Projection Policy 能力

---

## 1. 背景与目标

终端最终交付产物位于 `4-assembly` 层，可以是 Android React Native 新架构 + Hermes，也可以是 Electron。终端运行时分为：

1. **原生 / 宿主层**：负责安装包、JS runtime 创建、bundle 装载、文件系统、重启、下载桥接、基础安全能力。
2. **TS 层**：负责业务运行时、TDP/TCP 协议、状态机、热更新策略解释、更新包生命周期管理。

当前 `终端版本管理说明.md` 已覆盖 `assemblyVersion`、`buildNumber`、`bundleVersion`、`runtimeVersion`、manifest 同步与发布脚本，但还缺少完整 TS 热更新设计：更新包元数据、服务端发布模型、projection 契约、终端状态机、主副屏一致性、版本上报、assembly 启动选择与回滚。

本设计把“热更新选择谁命中”的能力交给 TDP Dynamic Group / Projection Policy，把“终端是否能安全安装并何时生效”的能力放在 TS 层，把“真正加载哪个 bundle 与异常回滚”的能力放在 assembly 宿主层。

---

## 2. 设计原则

1. **TS 更新只更新 TS bundle 与静态资源**：不改变原生模块 ABI、不修改 native 依赖、不修改宿主启动协议。
2. **终端不执行 selector DSL**：终端只消费服务端通过 `terminal.group.membership` 与 resolved projection 下发的最终 desired hot update。
3. **同一机器主副屏必须同版本**：多屏机器以主屏为协调者，副屏不得独立选择不同 bundle。
4. **先下载校验，后标记就绪**：只有哈希、签名、manifest、兼容性全部通过，才能把更新包写入 `ready`。
5. **应用热更新必须可回滚**：JS runtime 启动失败、未完成加载通知、连续崩溃，都必须回滚到上一个已知可用版本或内置 bundle。
6. **服务端发布 desired，不代表终端必装**：终端根据本地事实、版本约束、下载状态、电源/营业状态、重启策略做最终执行。
7. **版本事实上报是闭环必需品**：JS runtime 启动时必须上报当前实际运行版本，TCP 后台展示版本历史与 desired/actual 偏差。

---

## 3. 当前基础能力核对

### 3.1 已有版本真相源

当前 assembly 版本真相源包括：

- `4-assembly/android/mixc-retail-assembly-rn84/release.manifest.json`
- `_old_/4-assembly/android/mixc-retail-rn84v2/release.manifest.json`
- `_old_/4-assembly/electron/mixc-retail-v1/release.manifest.json`

这些 manifest 当前包含：

- `appId`
- `platform`
- `product`
- `assemblyVersion`
- `buildNumber`
- `bundleVersion`
- `runtimeVersion`
- `channel`
- `minSupportedAppVersion`
- `targetPackages`
- `git`
- `artifacts`

Android RN84 装配层已生成：

- `4-assembly/android/mixc-retail-assembly-rn84/src/generated/releaseInfo.ts`

并在 topology hello 中带出：

- `assemblyAppId`
- `assemblyVersion`
- `buildNumber`
- `bundleVersion`
- `runtimeVersion`
- `protocolVersion`
- `capabilities`

### 3.2 已有状态与 projection 能力

`tdp-sync-runtime-v2` 已支持：

- snapshot / changes 增量同步
- projection repository 持久化
- `GROUP` scope resolved chain：`PLATFORM < PROJECT < BRAND < TENANT < STORE < GROUP(rank asc) < TERMINAL`
- `terminal.group.membership` projection
- 重启恢复测试

### 3.3 已有 assembly 能力

`mixc-retail-assembly-rn84` 已支持：

- `PlatformPorts.appControl.restartApp()`
- `PlatformPorts.stateStorage` / `secureStateStorage`
- `reportAppLoadComplete(displayIndex)` 通知原生首屏加载完成
- topology 主副屏运行时信息 hello
- Android 原生 `AppRestartManager`

### 3.4 缺口

仍需新增：

- 热更新包构建与元数据 schema
- TCP 包上传、解析、存储、管理与下载 API
- hot update desired projection topic
- TS 本地 hot update state slice 与状态机
- 下载/校验/解压适配器 port
- assembly bundle resolver 与回滚控制
- JS runtime 版本事实上报与历史
- 后台页面：包管理、发布策略、终端版本历史、异常与回滚

---

## 4. 版本模型

### 4.1 版本字段分工

| 字段 | 所属层 | 含义 | 是否参与兼容判断 |
| --- | --- | --- | --- |
| `assemblyVersion` | 安装包 / assembly | 安装包主版本 | 是 |
| `buildNumber` | 安装包 / assembly | 原生构建号，递增 | 是 |
| `bundleVersion` | TS bundle | JS/TS 热更新版本 | 是 |
| `runtimeVersion` | assembly runtime ABI | TS bundle 可运行的宿主兼容边界 | 是，强约束 |
| `packageId` | TCP 热更新服务 | 上传包唯一 ID | 否 |
| `releaseId` | TCP 发布策略 | 一次 desired 发布 ID | 是，用于追踪 |
| `contentHash` | 更新包内容 | 包完整性 | 是 |
| `manifestVersion` | 更新元数据 | schema 版本 | 是 |

### 4.2 兼容约束

TS 热更新包必须声明：

```ts
interface HotUpdateCompatibility {
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
```

终端判定规则：

1. `appId` 必须等于当前 assembly `releaseInfo.appId`。
2. `platform`、`product` 必须一致。
3. `runtimeVersion` 必须完全一致。第一版不做 semver 范围匹配，避免 ABI 模糊。
4. `assemblyVersion` 和 `buildNumber` 若声明范围，当前安装包必须落在范围内。
5. `allowedChannels` 若存在，当前 channel 必须命中。
6. `requiredCapabilities` 必须全部具备。
7. `forbiddenCapabilities` 任一命中则拒绝。
8. `targetPackages` 第一版只做记录和后台展示，不作为终端强校验；后续可升级为包级兼容门槛。

### 4.3 是否允许降级

默认不允许安装低于当前 `bundleVersion` 的热更新包。只有 desired projection 明确声明：

```json
{
  "rollback": true,
  "allowDowngrade": true
}
```

终端才允许降级。回滚发布必须在 TCP 后台形成独立审计记录。

---

## 5. 热更新包格式

### 5.1 外层上传压缩包

根 package 脚本输出一个上传包，例如：

```text
hot-update-assembly-android-mixc-retail-rn84-1.0.0+ota.1.zip
```

外层 zip 结构：

```text
hot-update.zip
├── manifest/hot-update-manifest.json
├── payload/
│   ├── index.android.bundle
│   ├── assets/...
│   └── source-map/index.android.bundle.map
└── signatures/
    └── manifest.sig
```

Electron 使用：

```text
payload/
├── renderer.js
├── preload.js
├── assets/...
└── source-map/...
```

### 5.2 Hot update manifest

```ts
interface HotUpdateManifestV1 {
  manifestVersion: 1
  // 构建脚本可不填；TCP 上传校验通过后由服务端生成并写入包记录，desired payload 中必须有 packageId。
  packageId?: string
  appId: string
  platform: 'android' | 'electron'
  product: string
  channel: string
  bundleVersion: string
  runtimeVersion: string
  assemblyVersion: string
  buildNumber: number
  builtAt: string
  git: {
    commit: string
    branch: string
    dirty?: boolean
  }
  compatibility: HotUpdateCompatibility
  package: {
    type: 'full-js-bundle'
    entry: string
    assetsDir?: string
    sourceMap?: string
    compression: 'zip'
    size: number
    sha256: string
  }
  install: {
    strategy: 'replace-bundle'
    requiresRuntimeRestart: boolean
    maxRetainedPackages: number
  }
  restart: HotUpdateRestartPolicy
  rollout: {
    defaultStrategy: 'manual-policy'
    notes?: string
  }
  security: {
    hashAlgorithm: 'sha256'
    signatureAlgorithm?: 'ed25519'
    signature?: string
    signer?: string
  }
  releaseNotes?: string[]
}
```

### 5.3 包构建脚本

新增根脚本建议为：

```json
{
  "release:hot-update:package": "node scripts/release/package-hot-update.cjs"
}
```

交互式流程：

1. 当前工程选择活跃 assembly app：`4-assembly/android/mixc-retail-assembly-rn84`。
2. 若需要查阅旧实现，只读参考 `_old_/4-assembly/android/*` 或 `_old_/4-assembly/electron/*`。
2. 读取所选 assembly 目录下的版本 manifest。
3. 选择/输入 `bundleVersion` bump：patch ota、指定版本、回滚包。
4. 输入 release notes、channel、兼容范围、重启策略默认值。
5. 执行对应 bundle 构建命令。
6. 计算 payload hash、size、sourceMap 信息。
7. 写入 hot update manifest。
8. 打包 zip 到 `dist/hot-updates/`。
9. 输出包路径与 manifest 摘要。

第一版不新增复杂签名基础设施，但 manifest schema 保留签名字段；生产化前必须接入签名校验。

### 5.4 PackageId 生成规则

`packageId` 的真相源在 TCP 服务端，不在构建机器。构建脚本可以在 manifest 中留下 `packageId` 为空；上传接口完成校验后生成 `packageId`，把它写入 `hot_update_packages.package_id` 与服务端保存的 `manifest_json`。终端永远不从上传包里的可选 `packageId` 做信任判断，只信任 desired projection 中由服务端签发的 `packageId`、`packageSha256` 与下载 URL。

如果构建脚本预生成 `packageId`，服务端仍必须按 `(sandboxId, appId, bundleVersion, runtimeVersion, sha256)` 做重复校验；冲突时拒绝上传，而不是覆盖既有包。

---

## 6. TCP 服务端模型

### 6.1 表模型

#### `hot_update_packages`

| 字段 | 含义 |
| --- | --- |
| `package_id` | 包唯一 ID |
| `sandbox_id` | 沙箱隔离 |
| `app_id` | assembly appId |
| `platform` | android/electron |
| `product` | 产品线 |
| `channel` | 包 channel |
| `bundle_version` | TS bundle version |
| `runtime_version` | runtime ABI |
| `assembly_version` | 构建时 assembly version |
| `build_number` | 构建时 build number |
| `manifest_json` | 完整 manifest |
| `file_name` | 上传文件名 |
| `file_size` | zip size |
| `sha256` | zip hash |
| `storage_path` | mock server 本地存储路径 |
| `status` | `UPLOADED` / `VALIDATED` / `BLOCKED` / `DEPRECATED` |
| `created_at` / `updated_at` | 时间 |

#### `hot_update_releases`

| 字段 | 含义 |
| --- | --- |
| `release_id` | 发布 ID |
| `sandbox_id` | 沙箱 |
| `package_id` | 目标包 |
| `topic_key` | 固定为 `terminal.hot-update.desired` |
| `item_key` | 第一版固定为 `main` |
| `scope_type` / `scope_key` | 通常是 `GROUP` + groupId，也允许 `TERMINAL` 紧急覆盖 |
| `enabled` | 是否生效 |
| `desired_payload_json` | 下发 payload |
| `status` | `DRAFT` / `ACTIVE` / `PAUSED` / `SUPERSEDED` / `CANCELLED` |
| `created_by` | 操作人 |
| `created_at` / `updated_at` | 时间 |

#### `terminal_version_reports`

| 字段 | 含义 |
| --- | --- |
| `report_id` | 记录 ID |
| `sandbox_id` | 沙箱 |
| `terminal_id` | 终端 ID |
| `display_index` | display 数字索引 |
| `display_role` | `primary` / `secondary` / `single` |
| `app_id` | assembly appId |
| `assembly_version` | 当前安装包版本 |
| `build_number` | 当前 build number |
| `runtime_version` | 当前 runtimeVersion |
| `bundle_version` | 当前实际运行 bundle |
| `source` | `embedded` / `hot-update` / `rollback` |
| `package_id` | 当前包 ID，可为空 |
| `release_id` | 当前 desired release，可为空 |
| `state` | `BOOTING` / `RUNNING` / `FAILED` / `ROLLED_BACK` |
| `reason` | 上报原因 |
| `reported_at` | 时间 |

### 6.2 包上传 API

```http
POST /api/v1/admin/hot-updates/packages/upload
Content-Type: multipart/form-data
```

行为：

1. 保存 zip 到 mock server 本地存储目录。
2. 计算 zip sha256。
3. 解压读取 hot update manifest。
4. 校验 manifest 必填字段、entry 是否存在、payload hash 是否匹配。
5. 插入 `hot_update_packages`。
6. 返回 manifest 摘要和校验结果。

### 6.3 包管理 API

```http
GET    /api/v1/admin/hot-updates/packages
GET    /api/v1/admin/hot-updates/packages/:packageId
PUT    /api/v1/admin/hot-updates/packages/:packageId/status
GET    /api/v1/admin/hot-updates/packages/:packageId/download
```

`storage_path` 只允许服务端内部读取，不能下发给终端。`packageUrl` 必须由 TCP 服务端生成，第一版格式为：

```text
/api/v1/hot-updates/packages/:packageId/download?sandboxId=<sandboxId>&token=<short-lived-token>
```

下载接口必须以文件流返回上传 zip，并校验 `sandboxId`、`packageId`、包状态、token 与 hash 元数据。终端校验 URL 时只接受当前 TCP server baseUrl 下的该路径前缀，不接受 `file://`、绝对本地路径或任意外链。

### 6.4 发布 API

```http
POST   /api/v1/admin/hot-updates/releases
GET    /api/v1/admin/hot-updates/releases
GET    /api/v1/admin/hot-updates/releases/:releaseId
PUT    /api/v1/admin/hot-updates/releases/:releaseId
POST   /api/v1/admin/hot-updates/releases/:releaseId/activate
POST   /api/v1/admin/hot-updates/releases/:releaseId/pause
POST   /api/v1/admin/hot-updates/releases/:releaseId/cancel
POST   /api/v1/admin/hot-updates/releases/:releaseId/preview-impact
```

`activate` 的核心动作是创建或更新一条 Projection Policy：

- `topicKey = terminal.hot-update.desired`
- `itemKey = main`
- `scopeType/scopeKey = release.scopeType/scopeKey`
- `payloadJson = desired payload`

这样新终端上线后会通过 Dynamic Group 持续命中，不会错过历史发布。

### 6.5 版本上报 API

```http
POST /api/v1/terminals/:terminalId/version-reports
GET  /api/v1/admin/terminals/:terminalId/version-history?sandboxId=<sandboxId>
GET  /api/v1/admin/hot-updates/version-drift?sandboxId=<sandboxId>
```

终端上报接口延续现有 `/api/v1/terminals/...` 风格，body 必须携带 `sandboxId`；服务端用 `sandboxId + terminalId` 校验终端存在性。后台查询接口走 `/api/v1/admin/...`，通过 query 传 `sandboxId`，与当前管理后台列表 API 保持一致。

终端在以下时机上报：

1. JS runtime 启动后、业务初始化前：`BOOTING`。
2. `reportAppLoadComplete` 前后：`RUNNING`。
3. 热更新包下载完成：`READY` 可作为扩展状态记录。
4. 应用新 bundle 后首次启动成功：`RUNNING` + `source=hot-update`。
5. 启动失败或回滚：`FAILED` / `ROLLED_BACK`。

---

## 7. TDP Projection 契约

### 7.1 Topic

```text
terminal.hot-update.desired
```

`itemKey` 第一版固定为：

```text
main
```

原因：同一终端同一时刻只能有一个最终 desired TS bundle。后续如要拆分“业务包 / 插件包”，再扩展 itemKey。

### 7.2 Desired Payload

```ts
interface TerminalHotUpdateDesiredV1 {
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
  restart: HotUpdateRestartPolicy
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
```

### 7.3 Restart Policy

```ts
type HotUpdateRestartPolicy =
  | { mode: 'immediate'; graceMs?: number }
  | { mode: 'idle'; idleWindowMs: number; deadlineAt?: string }
  | { mode: 'next-launch' }
  | { mode: 'prompt-user'; promptDeadlineAt?: string; fallback: 'idle' | 'next-launch' | 'immediate' }
  | { mode: 'scheduled'; earliestAt: string; latestAt?: string }
  | { mode: 'manual'; operatorInstruction?: string }
```

第一版终端只实现：

- `immediate`
- `idle`
- `next-launch`
- `manual`

`prompt-user` 和 `scheduled` 先进入状态机但不触发 UI，实现时可降级为 `manual` 或 `idle`，具体由 implementation plan 切片决定。

### 7.4 Desired 撤销与暂停语义

终端必须把 resolved desired 的缺失视为一个明确事件，而不是忽略：

1. `desired` 被删除或 resolved 为空：若 candidate 仍处于 `desired-received` / `download-pending`，清空 candidate；若正在 `downloading`，请求 adapter 取消下载；若已有 `ready` 但尚未应用，保留包文件但清空 ready 引用，等待清理策略回收；已运行的 current 不受影响。
2. `rollout.mode = paused`：不开始新下载；已在下载的任务暂停或取消；已 ready 的包保留但不得触发 restart；如果之后恢复为 `active` 且 packageId 未变，可以复用 ready。
3. `rollout.mode = rollback`：只有 `allowDowngrade=true` 时允许进入降级流程；否则记为 `compatibility-rejected`，reason 为 `DOWNGRADE_NOT_ALLOWED`。

---

## 8. 终端 TS 状态机

### 8.1 本地状态 slice

新增 `hotUpdate` state，持久化到 `stateStorage`：

```ts
interface HotUpdateState {
  current: HotUpdateAppliedVersion
  desired?: TerminalHotUpdateDesiredV1
  candidate?: HotUpdateCandidateState
  ready?: HotUpdateReadyState
  applying?: HotUpdateApplyingState
  previous?: HotUpdateAppliedVersion
  history: HotUpdateHistoryItem[]
  lastError?: HotUpdateError
}
```

关键字段：

```ts
interface HotUpdateAppliedVersion {
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

interface HotUpdateCandidateState {
  releaseId: string
  packageId: string
  bundleVersion: string
  status:
    | 'desired-received'
    | 'compatibility-rejected'
    | 'download-pending'
    | 'downloading'
    | 'downloaded'
    | 'verified'
    | 'unpacked'
    | 'ready'
    | 'failed'
  attempts: number
  reason?: string
  updatedAt: number
}

interface HotUpdateReadyState {
  releaseId: string
  packageId: string
  bundleVersion: string
  installDir: string
  entryFile: string
  manifest: HotUpdateManifestV1
  verifiedAt: number
  restartPolicy: HotUpdateRestartPolicy
}
```

### 8.2 History 保留策略

`history` 最多保留 50 条状态事件或最近 14 天事件，取更严格者。每次写入新事件时同步裁剪，避免 stateStorage 无限增长。包文件清理由 `install.maxRetainedPackages` 控制，history 与包文件不强绑定：删除旧包时追加一条 `package-pruned` 历史事件，但不删除历史摘要。

### 8.3 状态流

```text
resolved desired received
  -> compatibility check
  -> download pending
  -> downloading
  -> downloaded
  -> verify sha256/signature/manifest
  -> unpack to staging
  -> atomic promote to package dir
  -> ready
  -> wait restart policy
  -> appControl.restartApp()
  -> assembly loads ready bundle
  -> JS runtime reports BOOTING/RUNNING
  -> mark applied
```

失败分支：

- 兼容性失败：记录 `compatibility-rejected`，不上报安装失败，不重试下载。
- 下载失败：按 `maxDownloadAttempts` 重试，超过后 `failed`。
- 校验失败：立即 `failed`，不重试同一包，后台告警。
- 解压失败：清理 staging，允许重试。
- 启动失败：assembly 回滚，不进入 TS 状态机；下次 TS 启动时根据回滚标记上报。

### 8.4 Slice 1 重启恢复语义

Slice 1 不实现真实下载，因此 `download-pending` 是稳定等待态。重启恢复后如果 desired 仍然相同，保持 `download-pending`，不自动推进；如果 desired 已撤销，按 7.4 清空 candidate；如果 desired packageId 变化，重新执行兼容性判定并覆盖 candidate。Slice 1 测试只验证 projection -> 判定 -> pending/rejected 与持久化恢复，不模拟下载成功。

### 8.5 持久化真相源

TS 层本地最小真相源：

1. 当前实际运行版本 `current`。
2. 已验证待应用版本 `ready`。
3. 上一个可回滚版本 `previous`。
4. 启动失败计数 / 回滚标记。

运行期临时状态如下载进度可不强持久化，但状态迁移节点必须持久化，保证断电恢复可继续。

---

## 9. 下载、校验与解压适配器

### 9.1 Port 设计

在 `3-adapter` 层实现真实下载、文件系统、解压、哈希校验；在 `4-assembly` 层桥接到 TS runtime。

建议新增 platform port：

```ts
interface HotUpdatePort {
  getInstallRoot(): Promise<string>
  downloadPackage(input: {
    packageId: string
    url: string
    sha256: string
    size: number
    onProgress?: (progress: { receivedBytes: number; totalBytes?: number }) => void
  }): Promise<{ localPath: string; sha256: string; size: number }>
  verifyPackage(input: {
    localPath: string
    sha256: string
    signature?: string
  }): Promise<{ ok: true } | { ok: false; reason: string }>
  unpackPackage(input: {
    packageId: string
    localPath: string
    stagingDir: string
  }): Promise<{ stagingDir: string; manifestPath: string }>
  promotePackage(input: {
    packageId: string
    stagingDir: string
    installDir: string
  }): Promise<{ installDir: string }>
  removePackage(input: { packageId: string }): Promise<void>
  readBootMarker(): Promise<HotUpdateBootMarker | null>
  writeBootMarker(marker: HotUpdateBootMarker): Promise<void>
  clearBootMarker(): Promise<void>
}
```

第一版如果不想扩大 `PlatformPorts`，可以在 assembly module 内部注入 `hotUpdateAdapter`，但最终应收敛到 platform port，避免 TS runtime 直接依赖 native module。

### 9.2 Android 与 Electron 实现边界

Android 第一版通过 3-adapter 的 RN native module 承担下载、sha256、zip 解压、原子 rename、boot marker 读写。assembly Kotlin 侧还必须提供 bundle resolver，见 11.1。

Electron 第一版不作为 Slice 1-4 的强制验证目标，但接口必须保持平台中立。Electron 后续实现使用 Node.js `fs` / `crypto` / `zlib` 或打包工具对应能力完成相同 port；bundle 生效方式不是 Android 的 `getJSBundleFile()`，而是在 Electron main/renderer bootstrap 中选择本地 renderer/preload 入口。Electron 没有现成的 `reportAppLoadComplete` 原生等价物，需要在 renderer bootstrap 成功后通过 IPC 向 main process 上报 load complete，再由 main process 统一写 boot marker。

### 9.3 安装目录

建议目录：

```text
<app-data>/hot-updates/
├── packages/<packageId>/
│   ├── manifest.json
│   ├── index.android.bundle
│   └── assets/...
├── staging/<packageId>/...
└── boot-marker.json
```

promote 必须尽量原子化：先写 staging，校验成功后 rename 到 packages。

`boot-marker.json` 必须用平台原子写策略：写临时文件、fsync、rename 覆盖；Android 多进程场景还需要 native 侧文件锁或单写入者约束。第一版约束主屏为唯一写入者，副屏只读；assembly 原生健康检查需要写失败计数时，也必须通过同一个 native helper 串行化写入。

---

## 10. 主副屏同版本约束

### 10.1 角色分工

- 主屏 runtime：唯一下载者、唯一安装者、唯一决定 restart policy 的协调者。
- 副屏 runtime：只消费主屏同步状态，不独立下载、不独立应用 desired。
- assembly 宿主：所有 display 的 JS runtime 启动时读取同一个 boot marker / hot update install state。

### 10.2 状态同步

已有 runtime shell 支持 state sync 与 topology peer dispatch。热更新 slice 需要通过 `StateRuntimeSliceDescriptor` 显式声明：

```ts
{
  name: HOT_UPDATE_STATE_KEY,
  persistIntent: 'owner-only',
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record' | 'fields',
    getEntries: ...,
    applyEntries: ...,
  },
}
```

`topology-runtime-v2` 会按 `syncIntent === 'master-to-slave'` 选择可同步 slice，因此热更新同步是单向的。副屏 reducer 可以接收 state sync patch，但 hot update actor 必须检查 display role：只有 `displayIndex === 0` 或 topology role 为 master 时才能执行下载、promote、restart；副屏收到 `ready` 只能更新只读视图和上报状态，不能调用 `HotUpdatePort.downloadPackage()` 或 `appControl.restartApp()`。

主屏同步给副屏的字段包括：

- `current`
- `desired`
- `candidate.status`
- `ready`
- `lastError`

副屏收到 `ready` 后只展示/记录，不调用下载。真正重启由主屏触发 `appControl.restartApp()`，宿主整体重启或重建所有 JS runtime。

### 10.3 启动一致性

assembly 启动选择 bundle 时必须使用机器级共享状态，而不是 display 级状态。若主屏和副屏读到的目标不一致，宿主必须拒绝 hot update，退回 embedded bundle，并写入回滚原因：

```text
HOT_UPDATE_DISPLAY_VERSION_MISMATCH
```

---

## 11. Assembly 启动选择与回滚

### 11.1 Android Bundle Resolver 改造

当前 Android assembly 使用 `DefaultReactNativeHost`，只覆写了 `getPackages()`、`getJSMainModuleName()`、`getUseDeveloperSupport()` 和 `getDevLoadingViewManager()`，还没有覆写 bundle 路径选择。Slice 4 必须包含 Kotlin 侧改造：在 `MainApplication.kt` 的 `DefaultReactNativeHost` 中覆写 `getJSBundleFile()`，或使用 RN 0.84 `ReactHost` 等效 bundle loader 接口，让 release 模式在创建 JS runtime 前读取 hot update boot marker 并返回本地 bundle 文件路径。

该能力不属于纯 TS 层，必须作为 assembly 原生层任务单独验证。若 Kotlin bundle resolver 未完成，TS 层最多能把包推进到 `ready`，不能真正生效。

### 11.2 启动选择顺序

JS runtime 创建前，assembly native / JS bootstrap 读取 machine-level boot marker：

1. 没有 `ready`：加载 embedded bundle。
2. 有 `ready` 且未超过启动失败阈值：加载 hot update bundle。
3. 有 `ready` 但上次启动失败且超过阈值：回滚到 `previous` 或 embedded。
4. manifest 与当前原生事实不兼容：拒绝加载，回滚 embedded。

### 11.3 启动健康检查

复用现有 `reportAppLoadComplete(displayIndex)` 能力，但需要扩展 assembly 启动健康语义：

- 每个 display 的 JS runtime 启动时写入 `bootAttempt`。
- 主屏必须在 `healthCheckTimeoutMs` 内调用 load complete。
- 多屏机器所有 display 都完成 load complete 后，才能确认本次 hot update 成功。
- 如果主屏成功、副屏失败，也算整体失败，回滚整机版本。

### 11.4 回滚策略

回滚触发条件：

1. JS bundle 加载异常。
2. JS runtime 崩溃。
3. 超过 `healthCheckTimeoutMs` 未收到 load complete。
4. 连续 `maxLaunchFailures` 次启动失败。
5. 主副屏版本不一致。
6. manifest 与当前宿主不兼容。

回滚动作：

1. 写 `boot-marker`：`rollbackReason`。
2. 标记坏包为 `blocked`。
3. 切回 previous 或 embedded。
4. 重启 JS runtime / App。
5. 下次 TS 启动后上报 `ROLLED_BACK`。

---

## 12. 版本上报与历史追踪

### 12.1 上报内容

```ts
interface TerminalVersionReportV1 {
  schemaVersion: 1
  terminalId: string
  displayIndex: number
  displayRole: 'primary' | 'secondary' | 'single'
  appId: string
  platform: 'android' | 'electron'
  product: string
  assemblyVersion: string
  buildNumber: number
  runtimeVersion: string
  bundleVersion: string
  source: 'embedded' | 'hot-update' | 'rollback'
  packageId?: string
  releaseId?: string
  state: 'BOOTING' | 'RUNNING' | 'FAILED' | 'ROLLED_BACK'
  reason: 'runtime-start' | 'load-complete' | 'hot-update-applied' | 'rollback' | 'manual-report'
  bootId: string
  reportedAt: string
}
```

### 12.2 与 runtime facts 的关系

`terminal_runtime_facts` 面向 selector / membership 计算，是“当前终端可匹配事实”。

`terminal_version_reports` 面向审计和历史，是“每次启动与变化记录”。

服务端接收 version report 后应同步更新 terminal `deviceInfo.runtimeInfo`，触发 membership 重算。这样热更新后 `bundleVersion` 改变会影响后续 group 命中。

---

## 13. 管理后台设计

在现有 mock-terminal-platform 后台增加“热更新”页面，第一版不引入路由系统，接入当前 `sections`。

页面结构：

```text
热更新
├── 包管理
├── 发布策略
├── 终端版本
└── 回滚与异常
```

### 13.1 包管理

能力：

- 上传 hot update zip。
- 展示 manifest 摘要：appId、platform、runtimeVersion、bundleVersion、buildNumber、hash、size。
- 展示校验结果与错误。
- 标记 deprecated / blocked。
- 下载原始包。

### 13.2 发布策略

能力：

- 选择一个 package。
- 选择发布 scope：Dynamic Group 或 Terminal。
- 配置 restart policy。
- 预览影响终端：命中数量、当前版本分布、兼容失败数量、会被覆盖的 winner。
- 激活/暂停/取消发布。
- 跳转 TDP decision trace。

### 13.3 终端版本

能力：

- 展示每个终端 current / desired / ready / last report。
- 展示版本漂移：desired 已变更但 actual 未更新。
- 展示主副屏是否一致。
- 展示版本历史。

### 13.4 回滚与异常

能力：

- 按 package/release 查看失败终端。
- 查看失败原因分布：兼容失败、下载失败、校验失败、启动失败、回滚。
- 一键创建 rollback release：选择 previous package 或 embedded。
- blocked package 管理。

---

## 14. 安全与一致性

第一版必须做到：

1. sha256 校验 zip 与 payload。
2. manifest 中 `package.sha256` 与实际 entry hash 一致。
3. 解压路径防穿越，拒绝 `../`、绝对路径、符号链接逃逸。
4. packageUrl 只允许 TCP server 生成的下载地址，终端不接受任意外链。
5. 终端拒绝不匹配 `appId/runtimeVersion/platform/product` 的包。
6. 下载与安装状态持久化，断电后可继续或清理。

生产化前必须补充：

1. manifest 签名。
2. 管理后台操作权限。
3. 发布审批。
4. 包存储对象不可变。
5. release 审计与撤销保护。

---

## 15. 最小落地切片

各 Slice 严格顺序依赖：Slice 2 可以先做服务端包管理，但端到端“终端收到 desired 并进入本地状态”依赖 Slice 1；Slice 3 依赖 Slice 1 的状态机；Slice 4 依赖 Slice 3 的 ready 状态和 assembly 原生 resolver；Slice 5 可与 Slice 2 部分并行，但版本漂移判断依赖 Slice 1/4 的上报字段。

### Slice 1：契约与本地判定

目标：不做真实下载，先把 desired projection、兼容性判定、本地状态机、重启恢复打通。

包含：

- 新增 hot update 类型与兼容性判定函数。
- 新增 TS hot update slice。
- 监听 `terminal.hot-update.desired/main` resolved projection。
- 处理 desired 缺失、`paused`、`rollback` 三类控制语义。
- 声明 `hotUpdate` slice 的 `syncIntent: 'master-to-slave'` 和副屏只读约束。
- 不兼容时写入 `compatibility-rejected`。
- 兼容时写入 `download-pending`。
- 覆盖持久化与重启恢复测试。

验证：

- 单元测试：兼容判定。
- runtime 测试：projection -> hot update state。
- restart 测试：pending/failed 状态重启恢复。

### Slice 2：TCP 包管理与 projection 发布

目标：后台能上传 zip、解析 manifest、创建 release，并通过 Projection Policy 下发 desired。

包含：

- 服务端表与 API。
- 本地文件存储。
- manifest 校验。
- 后台包管理和发布策略最小 UI。
- `terminal.hot-update.desired` policy 创建。

验证：

- server API 测试上传/解析/发布。
- web type-check/build。
- live TDP 测试终端收到 desired。

### Slice 3：下载、校验、解压、ready

目标：终端通过 adapter 下载 mock server 包，校验并落入 ready。

包含：

- `HotUpdatePort`。
- Android/Electron mock 实现或测试实现。
- TS actor 下载状态机。
- 解压安全校验。

验证：

- adapter 单元测试。
- runtime live 测试：desired -> ready。
- 断点恢复测试。

### Slice 4：assembly 启动选择与回滚

目标：ready 后重启，assembly 加载新 bundle，load complete 后确认 applied；失败可回滚。

包含：

- boot marker。
- bundle resolver。
- load complete 健康确认。
- rollback 标记与版本上报。

验证：

- assembly 单元测试。
- 启动成功测试。
- 启动失败回滚测试。
- 主副屏一致性测试。

### Slice 5：版本上报与后台观测

目标：TCP 后台可查看终端版本历史、desired/actual 偏差、失败原因。

包含：

- version report API。
- terminal runtime facts 同步更新。
- 后台终端版本页。
- drift 视图。

验证：

- server API 测试。
- web type-check/build。
- live 测试：启动上报 -> 后台历史。

---

## 16. 明确不做

第一阶段不做：

1. 原生安装包升级。
2. 增量 patch/diff 更新。
3. 多个业务插件包并行热更新。
4. 终端本地 selector DSL 求值。
5. 复杂灰度百分比引擎；灰度选择复用 Dynamic Group。
6. 用户可视化弹窗 UI；`prompt-user` 先保留为策略类型。
7. 生产签名基础设施；但 schema 和校验口预留。

---

## 17. 风险与决策

| 风险 | 决策 |
| --- | --- |
| runtimeVersion 范围匹配容易误判 ABI | 第一版必须完全相等 |
| 主副屏各自下载导致版本分裂 | 只允许主屏下载并写机器级 ready |
| desired 发布后新终端错过 | 通过 Dynamic Group / Projection Policy 持续命中解决 |
| 热更新包损坏导致启动循环 | assembly boot marker + load complete timeout + maxLaunchFailures 回滚 |
| 服务端认为已发布但终端拒绝 | 后台必须展示 desired/actual drift 和 reject reason |
| 回滚包版本低于当前版本 | 必须 `rollback=true` 且 `allowDowngrade=true` |

---

## 18. 与既有文档关系

- `终端版本管理说明.md` 继续作为版本字段与发布脚本说明，需补充 hot update package 脚本章节。
- `design/5.终端控制平面服务/04-热更新服务设计.md` 偏旧，保留为领域参考；本设计作为当前 monorepo 的 TS 热更新落地方案。
- `design/5.终端控制平面服务/前端设计/03-热更新管理模块.md` 偏 AntD/传统任务模型；当前后台以 mock-terminal-platform 现有 React 页面结构落地。
- Dynamic Group 设计是本设计的发布命中基础，不再重复实现 selector 系统。
