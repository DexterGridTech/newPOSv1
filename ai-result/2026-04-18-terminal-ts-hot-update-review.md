# Terminal TS Hot Update Design Review

> 文档路径：`docs/superpowers/specs/2026-04-18-terminal-ts-hot-update-design.md`
> Review 日期：2026-04-18

---

## 总体评价

设计整体完整，分层清晰，版本模型、状态机、回滚策略、主副屏一致性都有覆盖。切片化落地顺序合理。

但存在若干与现有代码不符的假设、逻辑缺口和遗漏项，需要在进入实施计划前解决。

---

## 一、设计缺陷（实施前必须解决）

### 1.1 Android bundle resolver 依赖 `getJSBundleFile` 覆写，但当前使用 `DefaultReactNativeHost`

文档第 11 节描述 assembly 启动时读取 boot marker 并选择 bundle，但核查 `MainApplication.kt` 发现当前使用 `DefaultReactNativeHost`，没有覆写 `getJSBundleFile()`。

RN 新架构（0.84+）中动态切换 bundle 路径需要在 `ReactNativeHost` 中覆写该方法，或使用 `ReactHost` 的 bundle loader 接口。这不是 TS 层能单独完成的，需要 Kotlin 侧配合。

**建议**：在设计中明确 Android 侧需要覆写 `getJSBundleFile()` 或等效接口，并说明这属于 assembly 原生层改动，需要单独列入实施计划。

---

### 1.2 主副屏状态同步依赖 `syncSliceName` 机制，但文档未说明 `hotUpdate` slice 如何接入

文档第 10.2 节说"热更新 slice 需要标记为可同步 slice"，但核查代码发现 topology state sync 使用的是 `syncSliceName` 注册机制（`topology-runtime-v2-live-state-sync-master-to-slave.spec.ts`）。

文档没有说明：
- `hotUpdate` slice 如何注册为可同步 slice？
- 同步是单向（主→副）还是双向？
- 副屏收到同步状态后，如何防止它触发下载逻辑？

**建议**：补充 `hotUpdate` slice 接入 state sync 的具体方式，并明确副屏侧的只读约束如何在代码层面强制。

---

### 1.3 `packageUrl` 安全约束与 mock server 本地存储路径冲突

文档第 14 节第 4 条：

> packageUrl 只允许 TCP server 生成的下载地址，终端不接受任意外链。

但第 6.1 节 `hot_update_packages` 表中有 `storage_path`（mock server 本地存储路径），第 6.3 节有 `GET /packages/:packageId/download` 接口。

问题：终端下载时用的 `packageUrl` 是 TCP server 的 `/download` 接口 URL，还是直接的文件路径？如果是前者，mock server 需要实现文件流式下载；如果是后者，违反了安全约束。

**建议**：明确 `packageUrl` 的生成规则，确认 mock server 的 `/download` 接口是否需要实现文件流，以及终端如何校验 URL 来源合法性。

---

## 二、逻辑模糊（需澄清）

### 2.1 `HotUpdateManifestV1` 中 `packageId` 是可选字段，但服务端依赖它做唯一标识

文档第 5.2 节：

```ts
packageId?: string  // 可选
```

但第 6.1 节 `hot_update_packages` 表以 `package_id` 为主键，第 7.2 节 desired payload 中 `packageId` 是必填字段。

如果 manifest 中 `packageId` 为空，服务端上传时如何生成 ID？终端收到 desired 后如何与本地已下载包对应？

**建议**：明确 `packageId` 在 manifest 中是"构建时可选、上传后服务端补填"，还是"构建时必须生成"。

---

### 2.2 `HotUpdateState.history` 的大小限制和清理策略未说明

文档第 8.1 节定义了 `history: HotUpdateHistoryItem[]`，但没有说明：
- history 最多保留多少条？
- 何时清理？
- 是否与 `maxRetainedPackages` 联动？

history 持久化到 stateStorage，如果无限增长会影响存储性能。

---

### 2.3 Slice 1 中"不做真实下载"但需要持久化 `download-pending` 状态，重启后如何处理

Slice 1 目标是"不做真实下载，先把状态机打通"，但状态机会写入 `download-pending`。重启后 TS 层恢复状态，发现 `download-pending`，此时没有下载能力（Slice 3 才实现），会发生什么？

**建议**：明确 Slice 1 的状态机在重启恢复时对 `download-pending` 的处理：是保持等待、是重置为 `desired-received`，还是需要 mock 下载能力。

---

### 2.4 `rollout.mode: 'paused'` 时终端的行为未定义

文档第 7.2 节 desired payload 中 `rollout.mode` 可以是 `'paused'`，但状态机（第 8.2 节）没有说明终端收到 `paused` 模式的 desired 时应该做什么：
- 停止已在进行的下载？
- 不开始新下载？
- 保留已下载的 ready 包？

---

## 三、遗漏项

### 3.1 缺少 `HotUpdatePort` 的 Electron 实现说明

文档第 9.1 节定义了 `HotUpdatePort`，第 5.1 节也覆盖了 Electron 的包格式，但整个文档对 Electron 的实现几乎没有说明：
- Electron 的文件系统操作与 Android 不同（Node.js fs vs React Native RNFS）
- Electron 的 bundle 加载方式与 Android 完全不同（`loadURL` vs `getJSBundleFile`）
- Electron 没有 `reportAppLoadComplete` 等价物

**建议**：在设计中明确 Electron 是否在第一版范围内，如果是，需要补充 Electron 侧的实现差异说明。

---

### 3.2 缺少 `boot-marker.json` 的并发写入保护

文档第 9.2 节定义了 `boot-marker.json`，第 11.1 节说"assembly native / JS bootstrap 读取 machine-level boot marker"。

问题：主副屏各自的 JS runtime 都可能在启动时读写 boot marker，存在并发写入风险。文档没有说明 boot marker 的写入是否需要文件锁或原子操作。

---

### 3.3 缺少 desired projection 被撤销时的终端行为

文档覆盖了 desired 下发后的状态机，但没有说明：
- 如果 release 被 cancel/pause，TDP projection 被删除或更新，终端收到 `desired=undefined` 时如何处理？
- 已经 `download-pending` 或 `downloading` 的任务是否取消？
- 已经 `ready` 的包是否清理？

---

### 3.4 版本上报 API 路径与现有 API 风格不一致

文档第 6.5 节：

```
POST /api/v1/terminals/:terminalId/version-reports
```

但现有 API 风格（参考 sandbox-api.spec.ts）是：

```
POST /api/v1/terminals/activate
GET  /api/v1/tdp/terminals/:terminalId/snapshot
```

版本上报是终端主动上报，不是 admin 接口，路径应在 `/api/v1/terminals/` 下，但需要确认是否需要 `sandboxId` 参数（现有接口都需要）。

---

## 四、小问题

1. **`HotUpdateManifestV1.install.requiresRuntimeRestart` 类型为 `true` 而非 `boolean`**：这意味着第一版永远需要重启，但如果未来支持不重启的热更新（如纯资源更新），这个字段需要改为 `boolean`。建议改为 `boolean`，当前值为 `true`。

2. **`terminal_version_reports` 表中 `display_id` 字段（`primary/secondary:N`）与 `TerminalVersionReportV1` 中的 `displayIndex: number` 不一致**：表用字符串，TS 类型用数字，需要统一。

3. **第 15 节 Slice 2 验证中"live TDP 测试终端收到 desired"依赖 Slice 1 的状态机**：但 Slice 2 的验证没有说明是否需要先完成 Slice 1，建议明确各 Slice 之间的依赖关系。

---

## 五、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 设计缺陷 | 3 | 实施前必须解决 |
| 逻辑模糊 | 4 | 实施前需澄清 |
| 遗漏项 | 4 | 建议补充 |
| 小问题 | 3 | 可顺手修正 |

最需要优先处理的：

1. **Android bundle resolver 需要 Kotlin 侧覆写**（1.1）——这是 Slice 4 的核心，不是纯 TS 工作
2. **主副屏 hotUpdate slice 同步机制**（1.2）——Slice 1 就需要考虑，否则后续主副屏一致性无法验证
3. **desired 被撤销时的终端行为**（3.3）——状态机不完整，Slice 1 实现时会遇到
