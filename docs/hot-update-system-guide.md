# 终端热更新系统详细说明

> 更新时间：2026-04-19  
> 适用范围：`newPOSv1` monorepo 当前已落地的终端 TS 热更新、TCP/TDP 动态 group / policy 发布、Android RN84 assembly 宿主协同  
> 主要代码位置：
> - 打包工具链：`scripts/release/package-hot-update.cjs`
> - 服务端：`0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateService.ts`
> - 动态 group / policy：`0-mock-server/mock-terminal-platform/server/src/modules/tdp/*`
> - 终端 TS 运行时：`1-kernel/1.1-base/tdp-sync-runtime-v2/*`
> - Android assembly：`4-assembly/android/mixc-retail-assembly-rn84/*`

---

## 1. 文档目的

本文档不是“未来设计稿”，而是基于当前仓库里已经存在的设计与实现，对整个热更新链路做一次完整梳理，覆盖：

1. 为什么这样设计。
2. 各层职责边界。
3. 关键实体与状态模型。
4. 服务端 API 与后台操作方法。
5. 终端 TS 状态机与原生宿主协同机制。
6. 打包脚本与产物格式。
7. 主副屏一致性、回滚、版本上报、动态 group / policy explain。
8. 已知限制、注意事项和排障方法。

这份文档的目标读者包括：

1. 平台/控制平面开发。
2. 终端 TS/runtime 开发。
3. Assembly/原生层开发。
4. 测试、联调、运维和后台使用方。

---

## 2. 总体设计结论

当前热更新系统采用四层分工：

1. **打包层**
   - 在仓库根目录执行脚本。
   - 从 `4-assembly` 已构建产物中抽取 TS bundle/资源。
   - 生成上传包 zip 与热更新 manifest。

2. **控制平面服务层**
   - 接收上传 zip。
   - 解析并校验 manifest / entry / 多文件 payload。
   - 生成 `packageId`、存储包、管理 release。
   - 通过 Dynamic Group / Projection Policy 持续下发 `terminal.hot-update.desired/main`。

3. **终端 TS 运行时层**
   - 只消费最终 resolved desired，不执行 selector。
   - 判断兼容性、准备下载、记录 ready/applying/current/previous/history。
   - 通过 `HotUpdatePort` 调用原生下载与 boot marker 写入。
   - 决定何时重启。

4. **Assembly 宿主层**
   - 管理包下载落地目录。
   - 管理 active/boot/rollback marker。
   - JS runtime 启动前决定读 embedded bundle 还是 hot update bundle。
   - 首次 load complete 后确认成功，否则累计失败次数并回滚。

最核心的设计原则只有三条：

1. **谁命中更新包，由服务端 group/policy 决定。**
2. **终端是否可装、何时生效，由 TS runtime 决定。**
3. **真正加载哪个 bundle、失败后如何回滚，由 assembly 宿主决定。**

---

## 3. 架构与职责边界

### 3.1 交付物层次

终端当前活跃交付物位于 `4-assembly/android/mixc-retail-assembly-rn84`。

历史 Electron 产物已迁入 `_old_/4-assembly/electron/mixc-retail-v1`，仅作参考，不再作为当前工程交付入口。

运行时分成两层：

1. **TS 层**
   - kernel/runtime/业务逻辑
   - TDP/TCP 通讯
   - 热更新状态机
   - 热更新兼容性判断
   - 版本事实上报

2. **原生层 / 宿主层**
   - 文件系统
   - 下载
   - zip 解压
   - hash 校验
   - JS runtime 启动
   - boot marker / active marker / rollback marker
   - app restart

### 3.2 为什么不让终端执行 selector

当前方案明确不让终端执行 selector DSL，而是：

1. 服务端维护 `selector_groups`
2. 服务端维护 `selector_group_memberships`
3. 服务端把 group membership 与 group-scope projection 物化为终端可消费事实
4. 终端只做 resolved projection

原因：

1. 避免在终端复制一套 group 引擎。
2. 新终端加入时，服务端可以自动补命中。
3. 规则变更、冲突和 explain 可以在后台统一观测。

---

## 4. 核心运行原理

### 4.1 热更新并不是“直接推 bundle”

热更新并不是服务端直接命令终端去下载一个 zip，而是先经过一层 desired projection：

1. 管理后台选择某个已上传包。
2. 选择发布范围：`GROUP` 或 `TERMINAL`。
3. 服务端创建 `hot_update_releases`。
4. release 激活时，服务端会创建/启用一条 `projection_policy`：
   - `topicKey = terminal.hot-update.desired`
   - `itemKey = main`
   - `scopeType = GROUP | TERMINAL`
   - `scopeKey = groupId | terminalId`
5. TDP 终端侧收到 projection。
6. `tdp-sync-runtime-v2` 用既有 scope 解析链求出最终 winner。
7. 终端本地把 winner 转成 `desired hot update state`。

也就是说，热更新是建立在 TDP 通用 projection 框架之上的一类业务主题。

### 4.2 Dynamic Group 是热更新的“命中层”

如果只把当时命中的终端 ID 展开后下发，会有一个致命问题：

1. 新终端后续加入项目/门店/机型范围时，拿不到之前发布的更新。

所以现在的逻辑是：

1. 后台允许按组合条件定义动态 group。
2. 服务端持续维护终端与 group 的 membership。
3. 发布时把 release 绑定到 group-scope policy。
4. 未来新加入、且满足 selector 的终端，会自动落到同一 policy 下。

这保证了“持续命中”。

### 4.3 主副屏一致性怎么保证

主副屏必须运行同一版本，当前机制是：

1. 热更新 slice 在 `tdp-sync-runtime-v2` 中声明：
   - `persistIntent = owner-only`
   - `syncIntent = master-to-slave`
2. 只有主屏/owner 才允许执行下载、写 marker、重启。
3. 副屏只接收同步后的热更新状态，不执行下载和重启。
4. Assembly 宿主启动时从机器级共享 marker 解析目标 bundle。
5. 主屏启动成功后，通过 `confirmLoadComplete` 把 boot marker 转为 active marker。
6. 副屏只跟随同一 installDir / entryFile 运行。

因此：

1. 更新包只下载一份。
2. 生效版本只有一份。
3. 主副屏不允许各自独立升级。

---

## 5. 版本模型

当前热更新链路同时涉及四类关键版本字段：

| 字段 | 含义 | 所属层 | 用途 |
| --- | --- | --- | --- |
| `assemblyVersion` | 安装包版本 | assembly/native | 宿主兼容边界 |
| `buildNumber` | 原生构建号 | assembly/native | 更细粒度兼容门槛 |
| `bundleVersion` | TS bundle 版本 | TS/hot update | 业务实际运行版本 |
| `runtimeVersion` | 宿主 runtime ABI 版本 | assembly/runtime | 强兼容门槛 |

额外还有：

| 字段 | 含义 |
| --- | --- |
| `packageId` | 上传包唯一 ID |
| `releaseId` | 一次发布行为 ID |
| `manifestSha256` | manifest 文件 hash |
| `packageSha256` | 整个上传 zip hash |

### 5.1 当前终端兼容性判断规则

终端 TS 层通过 `evaluateHotUpdateCompatibility()` 判定是否允许接受 desired：

位置：`1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateCompatibility.ts`

判定规则：

1. `appId` 必须一致。
2. `platform` 必须一致。
3. `product` 必须一致。
4. `runtimeVersion` 必须完全一致。
5. 若定义了 `minAssemblyVersion/maxAssemblyVersion`，当前 assemblyVersion 必须在范围内。
6. 若定义了 `minBuildNumber/maxBuildNumber`，当前 buildNumber 必须在范围内。
7. 若定义了 `allowedChannels`，当前 channel 必须命中。
8. 若定义了 `requiredCapabilities`，当前 capabilities 必须全满足。
9. 若命中了 `forbiddenCapabilities`，直接拒绝。
10. 默认不允许 `bundleVersion` 降级，除非：
    - `rollout.mode === rollback`
    - `allowDowngrade === true`

需要单独说明一个当前实现细节：

1. `evaluateHotUpdateCompatibility()` 本身已经支持 `allowedChannels` / `requiredCapabilities` / `forbiddenCapabilities`。
2. 但热更新 projection 自动 reconcile 进入 reducer 时，当前默认 `currentFacts` 主要从本地 `current` 推导。
3. 现状里这个默认推导并不会自动带出完整 channel/capabilities 真相，`channel` 当前默认是 `undefined`，`capabilities` 当前默认是空数组。
4. 这意味着：
   - `requiredCapabilities` / `forbiddenCapabilities` 只有在显式传入 `currentFacts` 的场景下才是完全可靠的；
   - `allowedChannels` 现在不应当作为“已经完全闭环”的生产判断条件看待。

换句话说，**`runtimeVersion / assemblyVersion / buildNumber / bundleVersion` 是当前已真正闭环的硬兼容主路径；channel/capabilities 字段能力已定义，但运行时事实注入仍建议后续补强。**

拒绝原因常量定义在：

- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateTopic.ts`

---

## 6. 动态 group / policy 机制

### 6.1 相关实体

数据库表定义见：

- `0-mock-server/mock-terminal-platform/server/src/database/schema.ts:274`

主要实体：

1. `selector_groups`
2. `selector_group_memberships`
3. `projection_policies`
4. `tdp_projections`
5. `hot_update_packages`
6. `hot_update_releases`
7. `terminal_version_reports`

### 6.2 Scope 链顺序

终端 resolved projection 的 scope 顺序现在是：

`PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> GROUP(rank asc) -> TERMINAL`

其中：

1. `GROUP` 不是单点，而是一个排序后的 group 列表。
2. 多个 group 的顺序由服务端预先计算。
3. 终端只按顺序展开，不重新排序。

决策 explain 逻辑在：

- `0-mock-server/mock-terminal-platform/server/src/modules/tdp/decisionService.ts`

### 6.3 Selector DSL

当前 group selector 是结构化 JSON DSL，典型字段包括：

1. `platformId`
2. `projectId`
3. `tenantId`
4. `brandId`
5. `storeId`
6. `profileId`
7. `templateId`
8. `assemblyAppId`
9. `runtimeVersion`
10. `assemblyVersion`
11. `bundleVersion`
12. `protocolVersion`
13. `devicePlatform`
14. `deviceModel`
15. `deviceOsVersion`
16. `capabilitiesAll`

当前规则：

1. 同一字段数组内是 OR。
2. 不同字段之间是 AND。
3. `capabilitiesAll` 要求全部命中。

相关代码：

- `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupTypes.ts`
- `0-mock-server/mock-terminal-platform/server/src/modules/tdp/groupMatcher.ts`

### 6.4 Explain 能力

后台现在已经支持解释：

1. selector explain
2. sample terminal 命中 explain
3. topic winner reason
4. policy impact warnings

主要代码：

- `0-mock-server/mock-terminal-platform/server/src/modules/tdp/policyCenterService.ts`
- `0-mock-server/mock-terminal-platform/server/src/modules/tdp/decisionService.ts`

实际用途：

1. 看某个 group 为什么命中/不命中。
2. 看某条 policy 为什么覆盖了 store/default。
3. 看 group-scope 是否会覆盖 lower scope。

补充两个和热更新直接相关的事实：

1. group membership 还会被物化成终端 projection，topic 为 `terminal.group.membership`。
2. 当某个终端 runtime facts 发生变化时，服务端会重算 memberships，并把已启用的 group policy 重新 materialize 给该终端。

这也是“新终端加入后能自动补命中”和“版本变化后 selector 结果会刷新”的根本原因。

---

## 7. 热更新包格式

### 7.1 上传包外层结构

脚本输出的是一个 zip，例如：

1. Android：
   - `hot-update-assembly-android-mixc-retail-rn84-1.0.0+ota.1.zip`
2. Electron：
   - `hot-update-assembly-electron-mixc-retail-v1-1.1.0+ota.3.zip`

zip 内至少包含：

1. `manifest/hot-update-manifest.json`
2. `payload/...`

### 7.2 manifest 关键字段

服务端 DTO 定义见：

- `0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateTypes.ts`

当前 manifest 核心字段：

1. `manifestVersion`
2. `appId`
3. `platform`
4. `product`
5. `channel`
6. `bundleVersion`
7. `runtimeVersion`
8. `assemblyVersion`
9. `buildNumber`
10. `builtAt`
11. `git`
12. `compatibility`
13. `package`
14. `install`
15. `restart`
16. `rollout`
17. `security`
18. `releaseNotes`
19. `artifacts`

一个简化后的 manifest 示例：

```json
{
  "manifestVersion": 1,
  "appId": "assembly-android-mixc-retail-rn84",
  "platform": "android",
  "product": "mixc-retail",
  "channel": "development",
  "bundleVersion": "1.0.0+ota.1",
  "runtimeVersion": "android-mixc-retail-rn84@1.0",
  "assemblyVersion": "1.0.0",
  "buildNumber": 1,
  "compatibility": {
    "appId": "assembly-android-mixc-retail-rn84",
    "platform": "android",
    "product": "mixc-retail",
    "runtimeVersion": "android-mixc-retail-rn84@1.0",
    "minAssemblyVersion": "1.0.0",
    "maxAssemblyVersion": "1.0.0",
    "minBuildNumber": 1,
    "maxBuildNumber": 1
  },
  "package": {
    "type": "full-js-bundle",
    "entry": "payload/index.android.bundle",
    "compression": "zip",
    "size": 123456,
    "sha256": "..."
  },
  "install": {
    "strategy": "replace-bundle",
    "requiresRuntimeRestart": true,
    "maxRetainedPackages": 2
  },
  "restart": {
    "mode": "manual",
    "operatorInstruction": "cashier idle restart"
  },
  "rollout": {
    "defaultStrategy": "manual-policy"
  },
  "security": {
    "hashAlgorithm": "sha256"
  }
}
```

### 7.3 `package` 字段的当前语义

这是一个容易误解的点。

当前 `package` 中有两层语义：

1. `package.entry / package.size / package.sha256`
   - 仍然表示“入口文件本身”的校验信息
   - 这是为了兼容当前服务端已有的 entry 校验路径

2. `package.files`
   - 表示整个 payload 内所有重要文件的清单
   - Android 通常包括：
     - `payload/index.android.bundle`
     - `payload/source-map/index.android.bundle.map`
   - Electron 通常包括：
     - `payload/renderer/primary_window/index.js`
     - `payload/main/index.js`
     - `payload/preload/primary.js`
     - `payload/renderer/secondary_window/index.js`
     - `payload/preload/secondary.js`

服务端现在会：

1. 校验 entry 文件。
2. 如果存在 `package.files`，逐个校验所有列出的文件。

实现位置：

- `0-mock-server/mock-terminal-platform/server/src/modules/admin/hotUpdateService.ts`

### 7.4 `artifacts` 字段

`artifacts` 用于记录构建时附带工件，不直接参与终端安装，但用于后台和审计展示。

例如 Electron 当前会记录：

1. `packagedAppVersion`

---

## 8. 打包工具链

### 8.1 根脚本入口

当前统一入口：

- `node scripts/release/package-hot-update.cjs`

帮助命令：

```bash
node scripts/release/package-hot-update.cjs --help
```

### 8.2 支持的 app

当前已收口支持：

1. `assembly-android-mixc-retail-rn84`
2. `assembly-electron-mixc-retail-v1`

### 8.3 核心参数

支持：

1. `--app`
2. `--channel`
3. `--restartMode`
4. `--operatorInstruction`
5. `--releaseNotes`
6. `--build-if-missing true|false`

### 8.4 当前构建策略

脚本现在不再依赖 `corepack yarn workspace`，而是直接在本地目录执行构建：

1. Android：
   - `tsc --noEmit`
   - `./gradlew createBundleReleaseJsAndAssets --rerun-tasks`
2. Electron：
   - `tsc -p tsconfig.check.json --noEmit`
   - `node .../@electron/rebuild/lib/cli.js -f -w better-sqlite3`
   - `node .../@electron-forge/cli/dist/electron-forge.js package`

代码位置：

- `scripts/release/package-hot-update.cjs`
- `scripts/release/release-bundle-full.cjs`

### 8.5 真实产物输出

输出目录：

- `dist/hot-updates/`

每次生成两类文件：

1. zip 产物
2. `*.summary.json`

`summary.json` 里包含：

1. `fileName`
2. `outputPath`
3. `fileSize`
4. `sha256`
5. `manifest`

推荐做法：

1. 上传前先看一眼 `summary.json`
2. 确认 `bundleVersion`
3. 确认 `compatibility`
4. 确认 `package.files`
5. 确认 `artifacts`

---

## 9. 服务端实体说明

### 9.1 `hot_update_packages`

表示一次成功上传并通过校验的热更新包。

关键字段：

1. `packageId`
2. `sandboxId`
3. `appId`
4. `platform`
5. `product`
6. `channel`
7. `bundleVersion`
8. `runtimeVersion`
9. `assemblyVersion`
10. `buildNumber`
11. `manifestJson`
12. `manifestSha256`
13. `fileName`
14. `fileSize`
15. `sha256`
16. `storagePath`
17. `status`

当前状态值在后台主要使用：

1. `VALIDATED`
2. `BLOCKED`

### 9.2 `hot_update_releases`

表示一次“将某个 package 发布给某个 scope”的行为。

关键字段：

1. `releaseId`
2. `packageId`
3. `topicKey`
4. `itemKey`
5. `scopeType`
6. `scopeKey`
7. `enabled`
8. `desiredPayloadJson`
9. `policyId`
10. `status`
11. `createdBy`

状态上后台现在主要使用：

1. `DRAFT`
2. `ACTIVE`
3. `PAUSED`
4. `CANCELLED`

### 9.3 `terminal_version_reports`

表示终端每次启动、运行、失败、回滚时上报的当前版本事实。

关键字段：

1. `terminalId`
2. `displayIndex`
3. `displayRole`
4. `appId`
5. `assemblyVersion`
6. `buildNumber`
7. `runtimeVersion`
8. `bundleVersion`
9. `source`
10. `packageId`
11. `releaseId`
12. `state`
13. `reason`
14. `reportedAt`

---

## 10. 服务端 API 说明

路由定义位置：

- `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`

### 10.1 包上传与查询

#### 上传

```http
POST /api/v1/admin/hot-updates/packages/upload
```

请求体：

```json
{
  "sandboxId": "sandbox_xxx",
  "fileName": "hot-update-xxx.zip",
  "contentBase64": "<zip-base64>"
}
```

服务端行为：

1. 解码 zip。
2. 解析 `manifest/hot-update-manifest.json`。
3. 校验 `entry`。
4. 校验 `package.files`。
5. 生成 `packageId`。
6. 落盘到 `server/data/hot-updates/<sandboxId>/<packageId>.zip`。
7. 写入 `hot_update_packages`。

#### 列表

```http
GET /api/v1/admin/hot-updates/packages?sandboxId=<sandboxId>
```

#### 详情

```http
GET /api/v1/admin/hot-updates/packages/:packageId?sandboxId=<sandboxId>
```

#### 状态更新

```http
PUT /api/v1/admin/hot-updates/packages/:packageId/status
```

请求体示例：

```json
{
  "sandboxId": "sandbox_xxx",
  "status": "BLOCKED"
}
```

常用状态：

1. `VALIDATED`
2. `BLOCKED`

#### 下载

```http
GET /api/v1/hot-updates/packages/:packageId/download?sandboxId=<sandboxId>&token=<token>
```

下载 token 当前为基于：

1. `sandboxId`
2. `packageId`
3. `package sha256`

生成的 hash。

### 10.2 Release 管理

#### 创建 release

```http
POST /api/v1/admin/hot-updates/releases
```

请求体示例：

```json
{
  "sandboxId": "sandbox_xxx",
  "packageId": "pkg_xxx",
  "scopeType": "GROUP",
  "scopeKey": "group_xxx",
  "createdBy": "admin-console",
  "restart": {
    "mode": "manual",
    "operatorInstruction": "cashier idle restart"
  }
}
```

#### 列表/详情

```http
GET /api/v1/admin/hot-updates/releases?sandboxId=<sandboxId>
GET /api/v1/admin/hot-updates/releases/:releaseId?sandboxId=<sandboxId>
```

当前返回会附带：

1. `desiredPayload`
2. `packageSummary`

#### 激活 / 暂停 / 取消

```http
POST /api/v1/admin/hot-updates/releases/:releaseId/activate
POST /api/v1/admin/hot-updates/releases/:releaseId/pause
POST /api/v1/admin/hot-updates/releases/:releaseId/cancel
```

这三个接口当前都要求 body 里带：

```json
{
  "sandboxId": "sandbox_xxx"
}
```

行为：

1. `activate`
   - 创建或启用对应 `projection_policy`
   - rollout mode 变为 `active`
2. `pause`
   - policy 仍保留，但 desired rollout mode 变为 `paused`
3. `cancel`
   - 删除 policy
   - release 标记为 `CANCELLED`

#### 影响预览

```http
POST /api/v1/admin/hot-updates/releases/:releaseId/preview-impact
```

请求体示例：

```json
{
  "sandboxId": "sandbox_xxx"
}
```

当前返回：

1. `total`
2. `terminalIds`
3. `scopeType`
4. `scopeKey`
5. `reason`
6. `warnings`

典型返回示例：

```json
{
  "total": 12,
  "terminalIds": ["terminal_a", "terminal_b"],
  "scopeType": "GROUP",
  "scopeKey": "group_xxx",
  "reason": "Dynamic group group_xxx currently matches 12 terminal(s); future matching terminals will receive the same release.",
  "warnings": []
}
```

### 10.3 版本上报与观测

#### 终端上报版本

```http
POST /api/v1/terminals/:terminalId/version-reports
```

请求体包含：

1. `sandboxId`
2. `displayIndex`
3. `displayRole`
4. `appId`
5. `assemblyVersion`
6. `buildNumber`
7. `runtimeVersion`
8. `bundleVersion`
9. `source`
10. `packageId`
11. `releaseId`
12. `state`
13. `reason`

请求体示例：

```json
{
  "sandboxId": "sandbox_xxx",
  "displayIndex": 0,
  "displayRole": "primary",
  "appId": "assembly-android-mixc-retail-rn84",
  "assemblyVersion": "1.0.0",
  "buildNumber": 1,
  "runtimeVersion": "android-mixc-retail-rn84@1.0",
  "bundleVersion": "1.0.0+ota.1",
  "source": "hot-update",
  "packageId": "pkg_xxx",
  "releaseId": "release_xxx",
  "state": "RUNNING"
}
```

#### 查看某终端版本历史

```http
GET /api/v1/admin/terminals/:terminalId/version-history?sandboxId=<sandboxId>
```

#### 查看版本漂移

```http
GET /api/v1/admin/hot-updates/version-drift?sandboxId=<sandboxId>
```

当前 drift 的含义是：

1. 每个终端最新一次版本事实上报的快照
2. 用于看当前运行 bundle/source/state

### 10.4 Dynamic Group / Explain 相关 API

虽然这些接口不属于“热更新包管理”本身，但热更新发布高度依赖它们。

#### Group 管理

```http
GET    /api/v1/admin/tdp/groups?sandboxId=<sandboxId>
POST   /api/v1/admin/tdp/groups
PUT    /api/v1/admin/tdp/groups/:groupId
DELETE /api/v1/admin/tdp/groups/:groupId
POST   /api/v1/admin/tdp/groups/preview
POST   /api/v1/admin/tdp/groups/recompute-all
POST   /api/v1/admin/tdp/groups/recompute-by-scope
POST   /api/v1/admin/tdp/groups/:groupId/recompute
GET    /api/v1/admin/tdp/groups/:groupId/memberships?sandboxId=<sandboxId>
GET    /api/v1/admin/tdp/groups/:groupId/stats?sandboxId=<sandboxId>
GET    /api/v1/admin/tdp/groups/:groupId/policies?sandboxId=<sandboxId>
```

#### Terminal 视角 Explain

```http
GET /api/v1/admin/tdp/terminals/:terminalId/memberships?sandboxId=<sandboxId>
GET /api/v1/admin/tdp/terminals/:terminalId/resolved-topics?sandboxId=<sandboxId>
GET /api/v1/admin/tdp/terminals/:terminalId/decision-trace?sandboxId=<sandboxId>
GET /api/v1/admin/tdp/terminals/:terminalId/topics/:topicKey/decision?sandboxId=<sandboxId>
```

#### Policy 管理与预演

```http
GET    /api/v1/admin/tdp/policy-center/overview?sandboxId=<sandboxId>
GET    /api/v1/admin/tdp/policies?sandboxId=<sandboxId>
GET    /api/v1/admin/tdp/policies/:policyId?sandboxId=<sandboxId>
POST   /api/v1/admin/tdp/policies/validate
POST   /api/v1/admin/tdp/policies
PUT    /api/v1/admin/tdp/policies/:policyId
DELETE /api/v1/admin/tdp/policies/:policyId
POST   /api/v1/admin/tdp/policies/preview-impact
```

热更新联调时，最常用的是这四组：

1. `groups/preview`
2. `terminals/:terminalId/memberships`
3. `terminals/:terminalId/topics/:topicKey/decision`
4. `policy-center/overview`

---

## 11. 后台页面与操作方法

前端页面代码：

- `0-mock-server/mock-terminal-platform/web/src/components/hot-update/HotUpdateCenter.tsx`

### 11.1 包上传

当前第一版为了避免新增 `multipart` 依赖，采用：

1. 输入文件名
2. 粘贴 zip 的 Base64

这不是最终体验最好的方案，但非常直接，方便调试和联调。

建议操作方法：

1. 先在根目录执行打包脚本生成 zip。
2. 用命令行把 zip 转成 base64。
3. 粘贴到后台。

macOS 示例：

```bash
base64 -i dist/hot-updates/hot-update-assembly-android-mixc-retail-rn84-1.0.0+ota.1.zip | pbcopy
```

### 11.2 包管理

后台能看到：

1. `packageId`
2. `appId`
3. `bundleVersion`
4. `runtimeVersion`
5. `status`
6. `payload 类型 / 文件数`
7. `downloadUrl`
8. `manifest JSON`

可以执行：

1. 阻断包：`BLOCKED`
2. 恢复包：`VALIDATED`

### 11.3 发布管理

当前支持：

1. 选择 package
2. 选择 scope type：
   - `GROUP`
   - `TERMINAL`
3. 选择 scope key
4. 创建 release
5. 激活 / 暂停 / 取消
6. 预览 impact

推荐后台操作顺序：

1. 先在 TDP Group 页面确认 selector 和 memberships。
2. 再在热更新中心创建 release。
3. 创建后先做 `preview-impact`。
4. 再做 activate。
5. 激活后立即切到 terminal decision / resolved topic 页面确认 winner。

### 11.4 版本观测

当前支持：

1. 看最新 drift 列表
2. 看单终端历史版本变化

常见观测字段：

1. `bundleVersion`
2. `source`
3. `state`
4. `packageId`
5. `reportedAt`

推荐联调视角：

1. 热更新中心看 package / release 生命周期。
2. TDP 页面看 group memberships / decision explain。
3. 版本观测页看 terminal 当前实际运行事实。

三者一起看，才能区分“没有命中”“已命中但不兼容”“已下载但未生效”。

---

## 12. 终端 TS 运行时机制

### 12.1 主题常量

热更新 desired topic 固定：

1. `topic = terminal.hot-update.desired`
2. `itemKey = main`

定义位置：

- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/hotUpdateTopic.ts`

### 12.2 状态模型

类型定义位置：

- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/hotUpdate.ts`

核心状态：

1. `current`
   - 当前实际运行版本
2. `desired`
   - 当前 resolved desired
3. `candidate`
   - 当前待处理候选包
4. `ready`
   - 已下载、已校验、可应用
5. `applying`
   - 已写 boot marker，等待重启/启动
6. `previous`
   - 上一个运行版本
7. `history`
   - 历史事件
8. `lastError`
   - 最近错误

#### `TerminalHotUpdateDesiredV1` 字段逐项解释

1. `schemaVersion`
   - desired payload 自身版本号，当前固定为 `1`
2. `releaseId`
   - 本次发布行为 ID
3. `packageId`
   - 指向已上传的热更新包
4. `appId / platform / product`
   - 终端标识与产品边界
5. `bundleVersion`
   - 目标 TS 版本
6. `runtimeVersion`
   - 目标宿主 ABI 版本，强一致门槛
7. `packageUrl`
   - 下载相对路径，不一定是绝对 URL
8. `packageSize / packageSha256 / manifestSha256`
   - 下载包与 manifest 校验信息
9. `compatibility`
   - 终端是否可安装的判断条件
10. `restart`
   - 生效策略元数据，不等于“所有 mode 都已自动实现”
11. `rollout`
   - 发布态：`active / paused / rollback`
12. `safety`
   - 下载重试、启动失败阈值、健康检查超时
13. `metadata`
   - 展示/运营辅助信息，如 releaseNotes、operator、reason

#### `HotUpdateState` 字段逐项解释

1. `current`
   - 当前已确认正在运行的版本事实
2. `desired`
   - 当前从 resolved projection 解出的目标版本
3. `candidate`
   - 本地正在处理的候选；其 `status` 会经历 `download-pending / downloading / ready / failed / compatibility-rejected`
4. `ready`
   - 下载和原生落地已完成，理论上可在下次启动或后续重启时生效
5. `applying`
   - 已向宿主写入待应用 marker，等待实际启动验证
6. `previous`
   - 最近一次切换前的版本事实
7. `history`
   - 近 50 条事件日志，用于调试而不是长期审计
8. `lastError`
   - 最近一次安装或应用错误

### 12.3 状态流转

核心 reducer 在：

- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/slices/tdpHotUpdate.ts`

典型状态流：

1. 收到 desired 后，若 rollout 是 `paused`
   - `paused`
2. 收到 desired 后，若兼容性失败
   - `compatibility-rejected`
3. 兼容性通过
   - `download-pending`
4. 开始下载
   - `download-started`
5. 下载并校验完成
   - `ready`
6. 写入 boot marker
   - `applying`
7. 重启后启动成功
   - `applied`
8. 启动失败/下载失败
   - `download-failed`
9. 宿主回滚
   - `rollback`

需要注意：

1. `types` 里虽然定义了 `desired-received` 事件类型，但当前 reducer 主路径并不会单独记录这一条 history。
2. 真正会落到 `history` 的是 `paused / compatibility-rejected / download-pending / download-started / ready / applying / applied / desired-cleared / rollback / version-reported` 等实际 dispatch 路径。

### 12.4 持久化与主从同步

热更新 slice 声明了：

1. `persistIntent = owner-only`
2. `syncIntent = master-to-slave`

意味着：

1. 由 owner/master 持久化热更新真相。
2. 由 master 把热更新状态同步给 slave。
3. slave 不主动执行 side effect。

### 12.5 Side effect 执行条件

`createTdpSyncRuntimeModuleV2()` 里有一个关键约束：

1. 如果不是主屏/owner，则直接返回，不做下载。

判定逻辑依赖：

1. `displayIndex`
2. topology `instanceMode`

也就是说，真正执行下载/写 marker 的只有主进程。

补充两个实现事实：

1. `installingPackageIds` 会在模块内部做去重，避免同一个 package 重复并发下载。
2. `maxDownloadAttempts` 是由 `desired.safety.maxDownloadAttempts` 控制的；超过后会直接 `markFailed`。

### 12.6 下载/安装流程

当 `candidate.status === download-pending` 时：

1. 通过 `resolveHttpUrlCandidates()` 把 `packageUrl` 转成绝对 URL 列表。
2. 调用 `HotUpdatePort.downloadPackage()`
3. 成功后 dispatch `markReady`
4. 调用 `HotUpdatePort.writeBootMarker()`
5. dispatch `markApplying`
6. 如果 `restart.mode === immediate`，立即调用 `appControl.restartApp()`

代码位置：

- `1-kernel/1.1-base/tdp-sync-runtime-v2/src/application/createModule.ts`

当前必须明确区分“元数据支持”和“自动执行支持”：

1. `immediate`
   - 当前 generic runtime 已自动实现：写 marker 后立即调用 `restartApp()`
2. `manual`
   - 当前只会把包准备好并进入 `applying`，不会自动重启；需要业务层/操作员/上层壳手动触发重启
3. `next-launch`
   - 当前不会主动触发重启，只会等待下一次自然重启
4. `idle`
   - 当前 manifest/desired 可以表达，但 generic runtime 还没有一套统一“闲时检测器”来自动执行

### 12.7 URL 候选列表机制

这里专门说明一下 `packageUrl` 的设计。

终端 desired 里只有一个相对路径，例如：

`/api/v1/hot-updates/packages/:packageId/download?...`

在终端侧会通过 transport runtime：

1. 查 server catalog
2. 解析出多个 baseUrl
3. 组合成多个绝对候选 URL

代码位置：

- `1-kernel/1.1-base/transport-runtime/src/foundations/urlCandidates.ts`

这样做的意义：

1. 热更新服务端不需要在 desired 中写死单个绝对地址。
2. 终端可以根据当前 server catalog 自动切换地址。
3. 原生层下载接口接收的是 URL 列表，而不是单 URL。

---

## 13. `HotUpdatePort` 端口契约

端口定义位置：

- `1-kernel/1.1-base/platform-ports/src/types/ports.ts`

当前接口：

1. `downloadPackage()`
2. `writeBootMarker()`
3. `readBootMarker()`
4. `clearBootMarker()`
5. `reportLoadComplete()`

职责分工：

1. TS 层只负责编排和状态记录。
2. 原生层负责真正下载、hash 校验、解压、落盘。

更细一点看：

1. `downloadPackage(input)`
   - 输入是 package 标识、多个 URL 候选、hash、size
   - 输出是安装目录、入口文件、manifest 路径、实际校验结果
2. `writeBootMarker(input)`
   - 从命名上看像“写 boot marker”
   - 但 Android RN84 当前实现实际上是**先写 active marker**
   - 真正的 boot marker 会在下次 primary 启动时由宿主 `preparePrimaryBoot()` 派生出来
3. `readBootMarker()/clearBootMarker()`
   - 调试与恢复辅助接口
4. `reportLoadComplete()`
   - 端口层已经定义
   - 但当前 Android assembly 真实生效路径里，`reportAppLoadComplete.ts` 直接调用的是 `nativeHotUpdate.confirmLoadComplete()`，并没有走 generic runtime 侧的 `HotUpdatePort.reportLoadComplete()`

因此，**`HotUpdatePort` 更像跨 assembly 的抽象契约；Android RN84 当前实现里，部分确认链路仍然在 assembly application 直接控制。**

---

## 14. Android Assembly 宿主机制

### 14.1 TS 到 Native 的桥

Assembly 侧桥接位置：

- `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/hotUpdate.ts`
- `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/hotUpdate.ts`
- `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/specs/NativeHotUpdateTurboModule.ts`

### 14.2 Native 下载逻辑

当前 `HotUpdateTurboModule.kt` 做的事情：

1. 按 packageId 创建 staging 目录。
2. 依次尝试 `packageUrls` 列表。
3. 下载 zip 到 staging。
4. 校验整个 zip 的 `packageSha256`。
5. 校验 zip 文件大小。
6. 解压 manifest。
7. 校验 manifest 的 `manifestSha256`。
8. 解压 entry bundle。
9. 校验 entry 的 `sha256`。
10. 将 staging promote 到正式目录。

注意：

1. 当前 Android Native 侧主要显式解压并校验 entry 与 manifest。
2. 多文件 `package.files` 的逐项校验现在由服务端上传阶段承担。
3. Android 侧当前默认把 entry 落成 `index.android.bundle`。
4. 这意味着 Android 现实现更偏向“单 entry JS bundle 宿主”；如果后续 Android 也要支持多 entry / 多 preload 风格，需要扩展 native 安装器。

### 14.3 Boot / Active / Rollback Marker

marker 存储类：

- `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/HotUpdateBootMarkerStore.kt`

当前有三类 marker：

1. `active-marker.json`
2. `boot-marker.json`
3. `rollback-marker.json`

语义：

1. `active-marker`
   - 已被认为可启动/可运行的目标版本
2. `boot-marker`
   - 本次启动尚未确认成功的尝试版本
3. `rollback-marker`
   - 因失败被回滚的记录

但要特别注意当前 RN84 的实际写入时序：

1. 下载完成后，`writeBootMarker()` 这个 TurboModule 方法名虽然叫“writeBootMarker”
2. 实际写入的是 `active-marker.json`
3. 到了下一次 primary 进程启动时，`preparePrimaryBoot()` 才会：
   - 读取 active
   - 递增 `bootAttempt`
   - 同步写出 `boot-marker.json`
4. 所以现在是“**先写 active，启动时派生 boot**”的实现，而不是“下载完成立即写 boot”

文档里如果只说“写 boot marker”容易误导，这里明确以代码现状为准。

### 14.4 启动流程

`HotUpdateBundleResolver.kt` 会在 JS runtime 启动前解析：

1. primary process：调用 `preparePrimaryBoot()`
2. secondary process：直接读 `active`

如果：

1. marker 指向的 bundle 不存在
2. 启动失败次数超过阈值

则：

1. 写 rollback marker
2. 清理 active/boot
3. 返回 `null`
4. 宿主回退到 embedded bundle

主副进程差异要点：

1. primary 进程负责累计 `bootAttempt`，并决定是否触发 rollback。
2. secondary 进程只消费当前 `active`，不自己递增失败计数。
3. 这和“主屏统一负责热更新真相”是一致的。

### 14.5 成功确认

当 JS runtime load complete 后，TS 层通过：

1. `nativeHotUpdate.confirmLoadComplete()`

通知原生层：

1. 把 `boot-marker` 清成稳定的 `active-marker`
2. `bootAttempt` 归零
3. 清理 rollback marker

这一步是“真正确认 hot update 生效”的关键。

当前 Android 真实调用位置是：

- `4-assembly/android/mixc-retail-assembly-rn84/src/application/reportAppLoadComplete.ts`

也就是 assembly application 在首屏加载完成后直接通知 native，而不是 generic hot update runtime 自动统一处理。

### 14.6 回滚同步到 TS 状态

Assembly 启动时会执行：

- `syncHotUpdateStateFromNativeBoot()`

它会：

1. 先读 rollback marker
2. 如果有 rollback：
   - 本地 hot update state 标记为 `rollback`
   - 记录 `markFailed`
3. 再读 active marker
4. 如果 active marker 存在：
   - 本地 state 标记 `source = hot-update`

所以 TS 恢复逻辑的优先级是：

1. 先承认 rollback 事实
2. 再承认 active hot update 事实
3. 最后若都没有，则保持 embedded current

---

## 15. 版本事实上报机制

### 15.1 上报入口

Assembly 端代码：

- `4-assembly/android/mixc-retail-assembly-rn84/src/application/reportTerminalVersion.ts`

TS runtime 会根据当前 hot update state 组装：

1. `bundleVersion`
2. `source`
3. `packageId`
4. `releaseId`

结合 assembly 固有信息：

1. `appId`
2. `assemblyVersion`
3. `buildNumber`
4. `runtimeVersion`

一起上报给控制平面。

### 15.2 服务端接收后的副作用

服务端 `reportTerminalVersion()` 除了写 `terminal_version_reports`，还会：

1. 更新 `terminal runtime facts`
2. 如果 runtime facts 指纹发生变化，则触发 memberships 重算
3. 若 memberships 变化，会把已启用 group policy 重新 materialize 到该终端

也就是说，终端当前跑的 bundleVersion 会反向影响 group 命中和后台观测。

### 15.3 建议上报时机

当前建议至少在以下时机上报：

1. JS runtime 启动中：`BOOTING`
2. JS runtime 启动完成：`RUNNING`
3. 启动失败：`FAILED`
4. 回滚后：`ROLLED_BACK`

但就 Android RN84 当前代码现状而言，已经明确接通的是：

1. `BOOTING`
2. `RUNNING`
3. `ROLLED_BACK`

`FAILED` 目前更多还是协议层可表达状态，尚未在现有 assembly 启动链里形成一条独立、稳定的事实上报路径。

---

## 16. 典型操作流程

### 16.1 打一个 Android 热更新包

```bash
node scripts/release/package-hot-update.cjs \
  --app assembly-android-mixc-retail-rn84 \
  --channel development \
  --restartMode manual \
  --operatorInstruction "cashier idle restart" \
  --releaseNotes "fixes,gray" \
  --build-if-missing true
```

### 16.2 打一个 Electron 热更新包

```bash
node scripts/release/package-hot-update.cjs \
  --app assembly-electron-mixc-retail-v1 \
  --channel test \
  --restartMode manual \
  --operatorInstruction "cashier idle restart" \
  --releaseNotes "electron,gray" \
  --build-if-missing true
```

### 16.3 上传包

1. 用 base64 把 zip 转出来。
2. 打开 mock-terminal-platform 后台。
3. 进入热更新中心。
4. 粘贴文件名和 base64。
5. 上传成功后确认包状态为 `VALIDATED`。

### 16.4 创建 group 并发布

1. 先在 TDP group 页创建/选择目标 group。
2. 回到热更新中心。
3. 选择 package。
4. 选择 `Scope Type = GROUP`。
5. 选择具体 group。
6. 创建 release。
7. 先点“预览影响”。
8. 确认命中的终端数和 reason。
9. 再点“激活”。

### 16.5 终端侧预期行为

1. 终端拿到 `terminal.hot-update.desired/main`
2. 本地兼容性判断通过
3. 主屏开始下载
4. 下载成功后写 marker
5. 按策略等待重启
6. 重启后切换到新 bundle
7. load complete 成功
8. 上报 `RUNNING + source=hot-update`

### 16.6 回滚场景

如果：

1. bundle 不存在
2. 启动失败次数超阈值
3. load complete 未成功确认

则宿主会：

1. 写 rollback marker
2. 清掉 active/boot
3. 回到 embedded bundle
4. TS 层同步成 `source=rollback`
5. 上报 `ROLLED_BACK`

---

## 17. 注意事项

### 17.1 当前仅支持 TS 层更新

热更新不允许：

1. 更新 native module ABI
2. 更新 Android/iOS/Electron 原生依赖
3. 修改宿主启动协议

凡是需要 native binary 变化的场景，必须发 assembly 新包，而不是热更新。

### 17.2 `runtimeVersion` 是强约束

当前不是 semver range，而是完全相等。

这意味着：

1. 换了 runtime ABI
2. 换了桥接接口
3. 换了宿主约定

都必须同步改 runtimeVersion。

### 17.3 默认不允许降级

除非明确 rollback 场景，否则：

1. `desired bundleVersion < current bundleVersion`
2. 会被直接拒绝

### 17.4 只有 `immediate` 已实现自动重启

虽然 restart metadata 支持：

1. `immediate`
2. `idle`
3. `manual`
4. `next-launch`

但当前 generic runtime 自动执行的只有：

1. `immediate`

其余几种：

1. `manual`
   - 当前依赖业务层或操作员触发重启
2. `next-launch`
   - 当前依赖用户/系统的自然重启
3. `idle`
   - 当前还没有通用 idle detector 落地

### 17.5 多文件 Electron 包依赖 `package.files`

Electron 当前不是单 bundle。

所以：

1. manifest 必须带 `package.files`
2. 服务端会逐项校验
3. 后台应关注 file count 是否符合预期

### 17.6 当前后台上传方式偏调试态

目前是：

1. 文件名 + Base64 文本框

适合调试，但不适合最终产品态大文件上传。

如果后续要产品化，建议增加：

1. multipart 上传
2. 文件拖拽
3. 大文件分片

### 17.7 Electron 构建会生成架构目录

Electron Forge 打包后，`.webpack` 产物可能落在：

1. `.webpack/main/...`
2. `.webpack/arm64/main/...`

当前脚本已经兼容这两类路径。

### 17.8 当前 Android 原生下载实现主要面向 RN84

本轮真正落地和验证的是：

1. Android RN84
2. Electron 打包/服务端/manifest 链路

Electron 终端侧实际运行宿主的热更新执行链，当前文档只描述控制平面与包格式兼容要求，尚未像 Android RN84 一样在 assembly 宿主完成一套同等深度的原生落地说明。

### 17.9 `allowedChannels` / capabilities 目前要谨慎使用

当前 manifest 和兼容性函数已经支持：

1. `allowedChannels`
2. `requiredCapabilities`
3. `forbiddenCapabilities`

但自动 reconcile 路径里，本地 `currentFacts` 还没有完整注入 channel/capabilities 真相。

因此现阶段建议：

1. 把 `runtimeVersion / assemblyVersion / buildNumber` 当作主兼容门槛
2. 把 channel/capabilities 当作“结构已就绪、需要继续补全运行时事实注入”的能力

### 17.10 下载 token 当前不是时效票据

下载 URL 里的 `token` 当前是由：

1. `sandboxId`
2. `packageId`
3. `package sha256`

做的确定性 hash。

它的作用更偏向：

1. 防止随意拼错 URL
2. 对下载请求做最基础的完整性校验

而不是：

1. 短时效签名
2. 一次性下载票据

### 17.11 `writeBootMarker` 是历史命名，不要按字面理解

接口名是 `writeBootMarker()`，但 Android RN84 当前真正写的是 `active-marker`。

要理解现在的启动链，必须记住：

1. 下载后写 active
2. primary 启动时派生 boot
3. load complete 后确认 active

---

## 18. 排障建议

### 18.1 包上传失败

先看服务端错误码：

1. `HOT_UPDATE_MANIFEST_NOT_FOUND`
2. `HOT_UPDATE_ENTRY_NOT_FOUND`
3. `HOT_UPDATE_ENTRY_HASH_MISMATCH`
4. `HOT_UPDATE_ENTRY_SIZE_MISMATCH`
5. `HOT_UPDATE_PACKAGE_FILE_NOT_FOUND:*`
6. `HOT_UPDATE_PACKAGE_FILE_HASH_MISMATCH:*`
7. `HOT_UPDATE_PACKAGE_FILE_SIZE_MISMATCH:*`

通常优先检查：

1. zip 内路径是否和 manifest 一致
2. `package.entry` 是否正确
3. `package.files` 是否完整

### 18.2 release 激活后没有终端命中

先看：

1. group membership
2. impact preview
3. policy center explain

重点检查：

1. selector 是否写错字段
2. runtime facts 是否已上报到服务端
3. group scope 是否真的命中该 terminal
4. terminal topic decision 里 `terminal.hot-update.desired/main` 的 winner 是谁

### 18.3 终端没有开始下载

检查：

1. `desired` 是否真的进入 hot update slice
2. `candidate.status` 是否为 `download-pending`
3. 当前 display 是否是主屏/owner
4. `HotUpdatePort` 是否已注入
5. `maxDownloadAttempts` 是否已超过
6. 是否被 `CHANNEL_NOT_ALLOWED` / `MISSING_CAPABILITY` / `FORBIDDEN_CAPABILITY` 拒绝

### 18.4 下载成功但未生效

检查：

1. `ready` 是否已写入
2. `active marker` 是否已写入
3. `restart.mode` 是不是 `manual`
4. 是否真的执行了 app restart
5. 启动时 primary 宿主是否把 active 派生为了 boot
6. 是否其实只是进入了 `applying`，但尚未发生下一次启动

### 18.5 启动后回滚

重点查：

1. `rollback marker`
2. `bootAttempt`
3. `maxLaunchFailures`
4. bundle 文件是否存在
5. 是否调用了 `confirmLoadComplete`
6. `HotUpdateBundleResolver` 是否因为 bundle 缺失回退到了 embedded

---

## 19. 当前实现边界与后续建议

### 19.1 已经落地的部分

1. Dynamic Group / Projection Policy 基础设施
2. 热更新包打包脚本
3. 服务端包上传与 release 管理
4. 后台热更新页面
5. TS runtime 兼容性判断与状态机
6. Android RN84 宿主下载 / marker / bundle resolver / rollback
7. 版本事实上报与历史/漂移观测

### 19.2 仍建议后续补强的部分

1. 后台文件上传改为 multipart
2. Electron 宿主侧热更新执行链与 Android 对齐
3. 热更新签名校验
4. “闲时重启 / 用户提示重启 / deadline 重启”完整策略引擎
5. 后台 release 详情页和异常诊断页
6. 包保留策略与旧包清理
7. runtime 侧 channel/capabilities 真相注入
8. `HotUpdatePort.reportLoadComplete()` 与 assembly 直接调用路径统一收口

---

## 20. 参考文档

详细设计与计划仍建议配合阅读：

1. `docs/superpowers/specs/2026-04-18-terminal-ts-hot-update-design.md`
2. `docs/superpowers/specs/2026-04-18-tdp-dynamic-group-policy-design.md`
3. `docs/superpowers/plans/2026-04-18-terminal-ts-hot-update-implementation.md`
4. `docs/superpowers/plans/2026-04-18-tdp-dynamic-group-policy-implementation.md`

这四份文档分别解决：

1. 热更新总体设计
2. 动态 group / policy 基础设计
3. 热更新实施切片
4. group / policy 实施切片
