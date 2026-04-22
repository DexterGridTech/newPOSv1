# Release Manifest 第一版打样说明

## 1. 本次落地了什么

本次已经在两个 `4-assembly` 包中落地了第一版发布元数据机制：

- `4-assembly/android/mixc-retail-rn84v2/release.manifest.json`
- `4-assembly/electron/mixc-retail-v1/release.manifest.json`

并新增了根目录发布脚本骨架：

- `scripts/release/shared.cjs`
- `scripts/release/prepare-release-manifest.cjs`
- `scripts/release/sync-assembly-version.cjs`
- `scripts/release/sync-android-version.cjs`
- `scripts/release/sync-electron-version.cjs`
- `scripts/release/bump-assembly-version.cjs`
- `scripts/release/bump-bundle-version.cjs`
- `scripts/release/bump-build-number.cjs`
- `scripts/release/validate-release-manifest.cjs`
- `scripts/release/inject-git-metadata.cjs`
- `scripts/release/release-assembly-android-full.cjs`
- `scripts/release/release-bundle-full.cjs`

同时补充了根脚本入口：

- `release:manifest:prepare`
- `release:manifest:validate`
- `release:manifest:inject-git`
- `release:assembly:sync-package-version`
- `release:assembly:sync-android-version`
- `release:assembly:sync-electron-version`
- `release:assembly:bump`
- `release:assembly:bump-build-number`
- `release:bundle:bump`
- `release:assembly:android:full`
- `release:bundle:full`

---

## 2. 这套机制现在能做什么

### 2.1 Release Manifest 作为发布真相源

现在每个 assembly 都有一份独立的发布元数据文件，用来描述：

- `assemblyVersion`
- `buildNumber`
- `bundleVersion`
- `runtimeVersion`
- `channel`
- `minSupportedAppVersion`
- `targetPackages`
- `git`
- `updatedAt`

这意味着后续安装包发布和 OTA 发布，都可以基于同一个事实来源推进。

---

### 2.2 自动 bump Assembly 版本

命令：

```bash
node scripts/release/bump-assembly-version.cjs --app assembly-android-mixc-retail-rn84v2 --version 1.1.0
```

作用：

- 更新 `assemblyVersion`
- 更新 `minSupportedAppVersion`
- 重置 `bundleVersion` 为 `1.1.0+ota.0`
- 自动生成新的 `runtimeVersion`
- 刷新 `updatedAt`

当前 `runtimeVersion` 规则为：

- Android：`android-mixc-retail-rn84v2@1.1`
- Electron：`electron-mixc-retail-v1@1.1`

也就是：

- `assembly-` 前缀会去掉
- 后面只保留 `major.minor`

---

### 2.3 自动 bump Build Number

命令：

```bash
node scripts/release/bump-build-number.cjs --app assembly-android-mixc-retail-rn84v2
```

或：

```bash
node scripts/release/bump-build-number.cjs --app assembly-android-mixc-retail-rn84v2 --build-number 1000100
```

作用：

- 默认递增 `buildNumber`
- 也可以手工指定新的构建号

这个能力主要用于安装包发布线。

---

### 2.4 自动 bump Bundle 版本

命令：

```bash
node scripts/release/bump-bundle-version.cjs --app assembly-android-mixc-retail-rn84v2 --channel test
```

作用：

- 根据当前 `assemblyVersion` 自动递增 `bundleVersion`
- 例如：
  - `1.1.0+ota.0` → `1.1.0+ota.1`
  - `1.1.0+ota.1` → `1.1.0+ota.2`
- 同时可刷新 `channel`
- 刷新 `updatedAt`

这个能力主要用于 OTA 发布线。

---

### 2.5 自动刷新 targetPackages 快照

命令：

```bash
node scripts/release/prepare-release-manifest.cjs --app assembly-android-mixc-retail-rn84v2 --channel development
```

作用：

- 重新扫描当前约定的关键 workspace 包版本
- 回填到 manifest 的 `targetPackages`
- 同时更新 `channel`
- 同时刷新 `updatedAt`

现在已支持 **按 assembly 过滤包快照**：

- Android assembly 只收集 Android adapter
- Electron assembly 只收集 Electron adapter

这样不会再出现跨平台 adapter 混入的问题。

---

### 2.6 自动注入 Git 元数据

命令：

```bash
node scripts/release/inject-git-metadata.cjs --app assembly-android-mixc-retail-rn84v2
```

作用：

- 自动注入：
  - `git rev-parse HEAD`
  - `git branch --show-current`
- 写入 manifest 的 `git.commit` 和 `git.branch`

这一步非常重要，因为它让发布记录可以精确回到代码提交。

---

### 2.7 自动校验 Manifest 合法性

命令：

```bash
node scripts/release/validate-release-manifest.cjs --app assembly-android-mixc-retail-rn84v2
```

当前会校验：

- `assemblyVersion` 是否为合法 semver
- `buildNumber` 是否为正整数
- `bundleVersion` 是否符合 `x.y.z+ota.n`
- `bundleVersion` 是否与 `assemblyVersion` 对齐
- `channel` 是否在允许范围
- `minSupportedAppVersion` 是否合法
- `minSupportedAppVersion` 是否不大于 `assemblyVersion`
- `runtimeVersion` 是否以正确 identity 开头
- `targetPackages` 是否为对象

这一步是后续 CI 接入的关键前置能力。

---

### 2.8 自动同步 package / Android / Electron 版本

命令：

```bash
node scripts/release/sync-assembly-version.cjs --app assembly-android-mixc-retail-rn84v2
node scripts/release/sync-android-version.cjs --app assembly-android-mixc-retail-rn84v2
node scripts/release/sync-electron-version.cjs --app assembly-electron-mixc-retail-v1
```

作用：

- 将 manifest 中的 `assemblyVersion`
  - 同步到 assembly 的 `package.json.version`
- Android：
  - `versionName = assemblyVersion`
  - `versionCode = buildNumber`
- Electron：
  - `package.json.version = assemblyVersion`

---

### 2.9 已有完整流程脚本雏形

#### Android 安装包发布流程脚本

```bash
node scripts/release/release-assembly-android-full.cjs --app assembly-android-mixc-retail-rn84v2 --version 1.2.0 --channel production
```

会依次执行：

1. bump assembly version
2. bump build number
3. prepare manifest
4. inject git metadata
5. validate manifest
6. sync package version
7. sync android gradle version
8. type-check
9. 调用现有 Android release build 命令

#### OTA 流程脚本

```bash
node scripts/release/release-bundle-full.cjs --app assembly-android-mixc-retail-rn84v2 --channel test
```

会依次执行：

1. bump bundle version
2. prepare manifest
3. inject git metadata
4. validate manifest
5. type-check
6. 构建 Android release JS bundle

其中 Android OTA 流程已经实际跑通，并成功生成 bundle 与 sourcemap。

---

## 3. 当前实际验证结果

本次已经完成真实验证：

### Android

- `assemblyVersion = 1.1.0`
- `buildNumber = 1000002`
- `bundleVersion = 1.1.0+ota.2`
- `runtimeVersion = android-mixc-retail-rn84v2@1.1`
- `channel = test`
- Git 元数据已成功写入：
  - `commit = 3d96e768989b67c15e4f4a70233b21520ddfd228`
  - `branch = main`

同时：

- Android `build.gradle` 已同步为：
  - `versionCode 1000002`
  - `versionName "1.1.0"`
- `release-bundle-full` 已实际跑通
- Metro/Gradle 已成功生成：
  - `index.android.bundle`
  - sourcemap

### Electron

- `assemblyVersion = 1.1.0`
- `buildNumber = 1000002`
- `bundleVersion = 1.1.0+ota.1`
- `runtimeVersion = electron-mixc-retail-v1@1.1`
- `channel = test`
- Git 元数据已成功写入

---

## 4. 当前最小可用发布流程

### Android 安装包发布前准备

```bash
node scripts/release/release-assembly-android-full.cjs --app assembly-android-mixc-retail-rn84v2 --version 1.2.0 --channel production
```

这个脚本已经能覆盖安装包发布前的大部分关键准备动作。

---

### Android OTA 发布前准备

```bash
node scripts/release/release-bundle-full.cjs --app assembly-android-mixc-retail-rn84v2 --channel production
```

这个脚本已经可以完成：

- bundleVersion 递增
- manifest 准备
- git 注入
- manifest 校验
- type-check
- Android JS bundle 构建

---

### Electron 安装包发布前准备

当前建议执行：

```bash
node scripts/release/bump-assembly-version.cjs --app assembly-electron-mixc-retail-v1 --version 1.2.0
node scripts/release/bump-build-number.cjs --app assembly-electron-mixc-retail-v1
node scripts/release/prepare-release-manifest.cjs --app assembly-electron-mixc-retail-v1 --channel production
node scripts/release/inject-git-metadata.cjs --app assembly-electron-mixc-retail-v1
node scripts/release/validate-release-manifest.cjs --app assembly-electron-mixc-retail-v1
node scripts/release/sync-assembly-version.cjs --app assembly-electron-mixc-retail-v1
node scripts/release/sync-electron-version.cjs --app assembly-electron-mixc-retail-v1
corepack yarn assembly:electron-mixc-retail-v1:package
```

Electron 的完整 full-flow 脚本这次还没有继续封装，但底层能力已经齐了。

---

## 5. 当前还没做什么

这次虽然已经进入“能走流程”的阶段，但仍然还有这些未完成项。

### 5.1 Electron 完整 full-flow 脚本

现在 Electron 只有：

- bump
- prepare
- validate
- sync

还没把这些完全串成一个 `release-assembly-electron-full.cjs`。

---

### 5.2 产物清单归档

当前还没有自动记录：

- APK / AAB 文件路径
- bundle 文件路径
- sourcemap 文件路径
- 构建时间
- 产物校验值

后续建议补一个：

- `finalize-release-manifest.cjs`

---

### 5.3 模块源码版本统一注入

当前大量 `src/index.ts` 中仍有：

```ts
version: '0.0.1'
```

这个问题这次还没有动。

后续建议：

- 统一生成 `generated/version.ts`
- 或构建前脚本注入

---

### 5.4 真实依赖图收集

当前 `targetPackages` 还是按“约定追踪包清单”收集。

更专业的下一步应该是：

- 根据目标 assembly 的依赖图自动收集
- 或结合 Turbo / workspace 依赖自动计算

---

### 5.5 CI/CD 还没接入

现在已经非常适合接入 CI 了，但这一步还没开始。

后续 CI 可以直接复用这些脚本：

- validate
- inject git
- bump
- sync
- full release flow

---

## 6. 当前结论

这次打样已经从“版本模型”进化到了“本地发布流程骨架”：

- `release.manifest.json` 已经成为可信的发布真相源
- `assemblyVersion / buildNumber / bundleVersion / runtimeVersion` 四套核心字段已经能真实跑通
- Android OTA 流程已经完成真实 bundle 构建验证
- Android / Electron 已经共享统一的发布元数据模型
- 下一步最自然的方向，就是补 Electron full-flow、产物归档、源码版本收敛和 CI 接入

---

## 7. 本轮继续补充的能力

在前一版基础上，本轮又补充了三类能力。

### 7.1 Electron 安装包 full-flow 脚本

新增：

- `scripts/release/release-assembly-electron-full.cjs`

命令：

```bash
node scripts/release/release-assembly-electron-full.cjs --app assembly-electron-mixc-retail-v1 --version 1.2.0 --channel production
```

它会依次执行：

1. bump assembly version
2. bump build number
3. prepare manifest
4. inject git metadata
5. validate manifest
6. sync package version
7. sync electron version
8. generate assembly release info
9. type-check
10. 调用现有 Electron package 命令
11. finalize manifest artifacts

注意：这个脚本已经落地，但本轮为了避免长时间打包，只验证了它依赖的底层脚本，没有实际跑完整 Electron package。

---

### 7.2 产物归档脚本

新增：

- `scripts/release/finalize-release-manifest.cjs`

命令：

```bash
node scripts/release/finalize-release-manifest.cjs --app assembly-android-mixc-retail-rn84v2
```

它会把构建产物信息写回 `release.manifest.json` 的 `artifacts` 字段。

当前 Android 已支持记录：

- APK 路径、大小、修改时间
- JS bundle 路径、大小、修改时间
- sourcemap 路径、大小、修改时间

当前 Electron 已支持记录：

- packaged app version 文件路径、大小、修改时间

后续可以继续扩展为：

- DMG / ZIP / exe 路径
- 文件 hash
- 上传地址
- 产物签名信息

---

### 7.3 Assembly 运行时版本信息生成文件

新增：

- `scripts/release/generate-assembly-release-info.cjs`
- `4-assembly/android/mixc-retail-rn84v2/src/generated/releaseInfo.ts`
- `4-assembly/electron/mixc-retail-v1/src/generated/releaseInfo.ts`

命令：

```bash
node scripts/release/generate-assembly-release-info.cjs --app assembly-android-mixc-retail-rn84v2
```

它会从 `release.manifest.json` 生成源码可读的版本信息：

- `assemblyVersion`
- `buildNumber`
- `bundleVersion`
- `runtimeVersion`
- `channel`
- `git`
- `updatedAt`

本轮也已经把两个 assembly 里的硬编码模块版本收敛掉：

- `4-assembly/android/mixc-retail-rn84v2/src/index.ts`
- `4-assembly/electron/mixc-retail-v1/src/index.ts`

现在它们不再写：

```ts
version: '0.0.1'
```

而是改为：

```ts
version: releaseInfo.assemblyVersion
```

这一步很关键，因为它让源码里的模块版本开始跟发布 manifest 对齐。

---

## 8. 本轮验证结果

本轮已执行并通过：

```bash
node scripts/release/generate-assembly-release-info.cjs --app assembly-android-mixc-retail-rn84v2
node scripts/release/generate-assembly-release-info.cjs --app assembly-electron-mixc-retail-v1
node scripts/release/finalize-release-manifest.cjs --app assembly-android-mixc-retail-rn84v2
node scripts/release/finalize-release-manifest.cjs --app assembly-electron-mixc-retail-v1
corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84v2 type-check
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check
```

验证结果：

- Android assembly type-check 通过
- Electron assembly type-check 通过
- Android manifest 已写入 artifacts 信息
- Electron manifest 已写入 artifacts 信息
- 两个 assembly 的 `src/index.ts` 已开始使用生成的 `releaseInfo.assemblyVersion`

---

## 9. 当前发布脚本成熟度评价

如果满分 10 分，当前本地脚本体系已经从 6 分提升到约 8 分。

已经具备：

- 版本真相源
- assembly version bump
- build number bump
- bundle version bump
- git 元数据注入
- manifest 校验
- Android / Electron 版本同步
- Android OTA bundle 构建流程
- Android 安装包 full-flow 脚本
- Electron 安装包 full-flow 脚本
- 产物归档
- assembly 源码版本信息生成

还没做到：

- 完整 CI/CD
- release note 自动生成
- artifact hash / 签名归档
- 真实依赖图自动分析
- 所有 kernel/ui/module 包源码版本统一收敛
- Electron OTA 构建与发布闭环

下一步最合理的方向是：

1. 补 release note 生成
2. 补 artifact hash
3. 把 kernel/ui/module 中散落的 `version: '0.0.1'` 逐步迁移到包级生成版本
4. 再开始设计 CI/CD 接入

---

## 10. 本轮继续补充的能力（release note + hash + 通用包版本收敛）

在上一轮基础上，本轮又补了三个非常关键的能力。

### 10.1 产物 hash 归档

`finalize-release-manifest.cjs` 现在不只记录：

- path
- size
- modifiedAt

还会额外记录：

- `sha256`

这意味着后续发布记录里，已经可以更可靠地区分“文件名一样但内容不同”的情况。

这一步对后续：

- 产物核对
- 运维归档
- 回滚校验
- CI 产物上传

都很重要。

---

### 10.2 release note 自动生成

新增：

- `scripts/release/generate-release-note.cjs`

命令：

```bash
node scripts/release/generate-release-note.cjs --app assembly-android-mixc-retail-rn84v2
```

输出位置：

- `ai-result/YYYY-MM-DD-<appId>-release-note.md`

当前 release note 会自动汇总：

- appId
- platform
- assemblyVersion
- buildNumber
- bundleVersion
- runtimeVersion
- channel
- minSupportedAppVersion
- git 信息
- targetPackages
- artifacts

本轮已经成功生成：

- `ai-result/2026-04-07-assembly-android-mixc-retail-rn84v2-release-note.md`
- `ai-result/2026-04-07-assembly-electron-mixc-retail-v1-release-note.md`

---

### 10.3 kernel / ui 包的硬编码版本统一收敛

这是本轮最重要的结构性改进之一。

新增：

- `scripts/release/generate-package-version-info.cjs`

它会遍历：

- `1-kernel`
- `2-ui`

下所有有 `package.json + src/index.ts` 的包，自动生成：

- `src/generated/packageVersion.ts`

例如：

- `1-kernel/1.1-cores/communication/src/generated/packageVersion.ts`
- `2-ui/2.3-integrations/mixc-retail/src/generated/packageVersion.ts`

然后把原来源码里的：

```ts
version: '0.0.1'
```

改为：

```ts
version: packageVersion
```

并自动补：

```ts
import {packageVersion} from './generated/packageVersion'
```

本轮已经完成的效果是：

- `1-kernel` 和 `2-ui` 下原本 23 处 `version: '0.0.1'`
- 已经全部清零

这意味着：

- 模块版本开始与 `package.json.version` 对齐
- 不再有一堆长期失真的占位版本号

这是非常关键的一步，因为它把“版本真相源”从散落字符串，收敛到了包元数据和生成文件上。

---

## 11. 本轮验证结果

本轮已执行并通过：

```bash
node scripts/release/generate-package-version-info.cjs
corepack yarn workspace @impos2/kernel-core-base type-check
corepack yarn workspace @impos2/kernel-core-communication type-check
corepack yarn workspace @impos2/kernel-mixc-user-login type-check
corepack yarn workspace @impos2/ui-core-base type-check
corepack yarn workspace @impos2/ui-integration-mixc-retail type-check
corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84v2 type-check
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check
node scripts/release/finalize-release-manifest.cjs --app assembly-android-mixc-retail-rn84v2
node scripts/release/finalize-release-manifest.cjs --app assembly-electron-mixc-retail-v1
node scripts/release/generate-release-note.cjs --app assembly-android-mixc-retail-rn84v2
node scripts/release/generate-release-note.cjs --app assembly-electron-mixc-retail-v1
```

验证结果：

- kernel / ui 包的硬编码版本已全部清零
- 关键 kernel / ui / assembly 包 type-check 通过
- manifest 产物归档已带 `sha256`
- release note 自动生成成功

---

## 12. 当前本地发布体系成熟度

如果继续按 10 分制评估，我现在会把这套本地发布体系打到 **8.5 分左右**。

已经具备：

- 版本真相源（manifest）
- assembly / build / bundle / runtime 四类核心版本
- manifest 校验
- git 注入
- Android / Electron 版本同步
- Android OTA bundle 构建流程
- Android / Electron assembly full-flow 骨架
- 产物归档
- artifact hash
- release note 自动生成
- assembly 版本生成文件
- kernel / ui 包版本生成文件
- 大范围清除硬编码 `0.0.1`

还差的内容主要是：

- CI/CD 真正接入
- Electron OTA 流程
- adapter 层和更多包的版本生成进一步统一
- 自动依赖图分析
- 发布审批 / 灰度 / 回滚策略接入

这说明你现在已经不是“从零设计版本体系”，而是已经拥有了一套相当靠谱的本地发布基础设施。

