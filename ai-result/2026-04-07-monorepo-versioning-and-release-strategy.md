# Monorepo 分层工程版本管理与发布策略（面向小白可落地版）

## 1. 这份文档要解决什么问题

你当前的工程是一个分层 Monorepo：

- `1-kernel`：业务逻辑层
- `2-ui`：UI 层
- `3-adapter`：适配层
- `4-assembly`：整合层 / 最终交付层

其中，`4-assembly` 是最终安装和交付给客户的产物，但它里面的 JS 部分未来又支持热更新，所以天然会出现两种版本：

1. **安装包版本**：用户安装到设备上的版本
2. **热更新版本**：用户无需重装即可下载的新 JS bundle 版本

如果没有一套清晰规范，后面一定会出现这些问题：

- 线上出问题时，不知道是“安装包问题”还是“热更新问题”
- Android / Electron / JS 版本号互相打架
- 每次发版都要手改多个地方，人工容易出错
- 灰度发布、环境区分、回滚都很痛苦
- 研发、测试、运维、产品说的“版本”不是同一个东西

所以，本方案的目标是：

- 让版本体系一眼能看懂
- 尽量减少人工改版本的次数
- 让安装包发布与 OTA 发布都可标准化
- 支持环境、灰度、分组发布
- 为后续 CI/CD 自动化打好基础

---

## 2. 最终推荐方案（一句话版）

**采用“双主线版本体系 + 包级研发版本辅助追踪”的方案。**

也就是：

- **`4-assembly` 版本**：作为最终交付版本（主版本）
- **JS Bundle 版本**：作为热更新版本（独立管理）
- **workspace 包版本**：作为内部研发追踪版本（不直接作为对外发布主版本）

这套方案最适合你当前项目：

- 分层明显
- 存在 RN 裸工程 / Electron 宿主
- JS 支持热更新
- 后续需要环境、灰度、回滚

---

## 3. 先建立一个最重要的认知

以后你们项目里会同时存在三种“版本”，它们都对，但作用不同。

### 3.1 用户看到的版本：Assembly 版本

这是安装包版本。

例如：

- Android APK：`2.3.0`
- Electron 安装包：`2.3.0`

它代表：

- 原生宿主能力
- adapter 集成能力
- assembly 集成结果
- 原生依赖与打包能力
- TurboModule / Hermes / Fabric / 本地资源

**凡是需要重新安装应用的变更，都归它管。**

---

### 3.2 线上运维关注的版本：Bundle 版本

这是 OTA 热更新版本。

例如：

- `2.3.0+ota.1`
- `2.3.0+ota.2`
- `2.3.1+ota.1`

它代表：

- 当前设备下载到的整套 JS 运行时 bundle
- 具体包含了哪些 kernel/ui/module 代码
- 是否需要回滚某次热更新

**凡是不重装应用，仅替换 JS 的变更，都归它管。**

---

### 3.3 研发内部关注的版本：Package 版本

这是每个 workspace 包自己的版本。

例如：

- `@impos2/kernel-mixc-user-login@1.4.2`
- `@impos2/ui-integration-mixc-retail@1.8.0`
- `@impos2/kernel-core-communication@1.2.0`

它代表：

- 这个包自己改了多少次
- 哪个包参与了本次 bundle 变化
- 包级变更记录和追踪

**它不是用户主版本。**

---

## 4. 为什么不能只用一个版本号解决一切

很多小项目会试图只用一个版本号，比如整个仓库都叫 `2.3.0`。

看起来简单，但在你的场景里会很快失效。

### 4.1 如果只用一个版本号，会发生什么

比如：

- `assembly` 没变，只改了一个 JS 登录逻辑
- 你发了热更新
- 那这个版本到底要不要改成 `2.3.1`？

如果改：
- 用户会误以为安装包升级了
- Android/Electron 的原生版本号就对不上

如果不改：
- 运维不知道线上到底跑的是哪套 JS 代码
- 回滚时不知道回滚的是哪次变更

这就是为什么：

**安装包版本** 和 **热更新版本** 必须分开。

---

## 5. 推荐的版本模型

下面是我建议你正式采用的版本模型。

### 5.1 Assembly 版本（主版本）

建议字段：

- `assemblyVersion`
- 示例：`2.3.0`

职责：

- 对外主版本
- 用于安装包交付
- 用于 Android / Electron 打包版本展示
- 用于兼容 OTA 的 runtime 基线

什么时候升级：

- 原生代码变化
- RN 宿主变化
- adapter 变化
- Electron main / preload 变化
- TurboModule / codegen 变化
- 打包配置变化
- 任何需要重新安装应用的变更

---

### 5.2 Build Number（构建号）

建议字段：

- `buildNumber`
- 示例：`2030007`

职责：

- 机器识别的单调递增版本号
- Android `versionCode`
- Electron 内部 build 编号
- 便于应用市场、灰度系统和运维追踪

什么时候升级：

- 每次发安装包都必须升级
- 必须严格递增

推荐规则：

- 由脚本自动生成
- 不允许人工随便写

---

### 5.3 Bundle 版本（OTA 版本）

建议字段：

- `bundleVersion`
- 示例：`2.3.0+ota.1`

职责：

- 标识当前完整 JS bundle 的版本
- 用于热更新平台发布与回滚
- 用于设备端识别当前下载的 JS 版本

什么时候升级：

- 任意进入 OTA 的 JS 代码变更
- 不涉及原生重装时，仅升这个版本

推荐规则：

- 以 `assemblyVersion` 作为基线
- 同一壳版本下递增 OTA 次数

例如：

- 安装包 `2.3.0`
- 第一次热更新：`2.3.0+ota.1`
- 第二次热更新：`2.3.0+ota.2`

如果壳升级到 `2.4.0`：

- 下一次 OTA 从 `2.4.0+ota.1` 重新开始

---

### 5.4 Runtime Version（运行时兼容版本）

建议字段：

- `runtimeVersion`
- 示例：`android-mixc-retail-rn84v2@2.3`

职责：

- 判断 OTA 是否能下发到某个安装包
- 隔离不同平台、不同 assembly、不同原生能力集

为什么需要它：

因为不是所有 JS bundle 都能给所有安装包使用。

例如：

- Android RN84 裸工程的 JS bundle
- Electron 的 JS bundle
- 两者虽然业务一样，但运行时能力、原生桥、宿主 API 并不完全相同

所以 OTA 发布时，不能只看 `bundleVersion`，还必须看 `runtimeVersion`。

推荐规则：

- `runtimeVersion = 平台 + assembly 身份 + 原生能力主线`
- 只有 `runtimeVersion` 匹配的安装包才能接收对应 OTA

---

### 5.5 Package Version（包级研发版本）

建议继续保留在各自 `package.json`：

- `1-kernel/*`
- `2-ui/*`
- `3-adapter/*`
- `4-assembly/*`

职责：

- 研发变更追踪
- 包级 changelog
- 影响范围分析
- 未来自动生成变更说明

重点：

- 它对研发很重要
- 但不应作为用户最终看到的版本主标识

---

## 6. 版本配置应该放在哪里

这是整套方案里最关键、最能减少人工成本的部分。

### 6.1 根目录 `package.json`

继续保留你的现状职责：

- workspace 管理
- 统一依赖版本
- 根脚本入口
- resolutions

**不要把它当成安装包主版本来源。**

根目录适合管：

- React / RN / TS / Redux / Axios 等统一依赖版本
- Turbo 任务编排
- 全局脚本

不适合管：

- Android 最终发版号
- Electron 最终发版号
- OTA bundle 版本

---

### 6.2 每个 `4-assembly` 自己维护一个发布清单文件

这是我最推荐的新做法。

例如新增：

- `4-assembly/android/mixc-retail-rn84v2/release.manifest.json`
- `4-assembly/electron/mixc-retail-v1/release.manifest.json`

建议结构如下：

```json
{
  "appId": "assembly-android-mixc-retail-rn84v2",
  "platform": "android",
  "product": "mixc-retail",
  "assemblyVersion": "2.3.0",
  "buildNumber": 2030007,
  "bundleVersion": "2.3.0+ota.2",
  "runtimeVersion": "android-mixc-retail-rn84v2@2.3",
  "channel": "production",
  "minSupportedAppVersion": "2.3.0",
  "targetPackages": {
    "@impos2/kernel-core-communication": "1.2.0",
    "@impos2/kernel-mixc-user-login": "1.4.2",
    "@impos2/ui-integration-mixc-retail": "1.8.0"
  },
  "git": {
    "commit": "abcdef123456",
    "branch": "release/2.3"
  }
}
```

这个文件的作用非常大：

- 安装包发布靠它
- OTA 发布靠它
- 排查线上问题靠它
- 回滚靠它
- CI 校验靠它

以后你只要看到这个文件，就能知道“这次交付到底是什么”。

---

### 6.3 `4-assembly/*/package.json`

这里保留 npm 包版本，但角色变成：

- package/workspace 管理版本
- 与 `release.manifest.json` 中的 `assemblyVersion` 对齐

专业做法：

- `package.json version` 与 `assemblyVersion` 一致
- 但真正发布时，统一以 `release.manifest.json` 为准

原因：

- `package.json` 更偏 npm/workspace 语义
- `release.manifest.json` 更偏交付物语义

二者都保留，但以 manifest 为发布单一真相源。

---

### 6.4 Android 原生版本

建议不要再手工改：

- `android/app/build.gradle` 中的 `versionCode`
- `android/app/build.gradle` 中的 `versionName`

改为：

- 构建前由脚本从 `release.manifest.json` 同步进去

对应关系：

- `versionName = assemblyVersion`
- `versionCode = buildNumber`

这样可以最大限度减少人工出错。

---

### 6.5 Electron 版本

同理：

- `4-assembly/electron/*/package.json` 的 `version`
- 以及 Electron 启动参数中注入的 appVersion

都建议由脚本根据 `release.manifest.json` 自动同步。

---

### 6.6 `src/index.ts` 里的模块 `version`

你现在很多包里都有：

```ts
version: '0.0.1'
```

这在研发早期可以理解，但长期来看不够规范。

建议：

- 这些模块内部 `version` 不再手写死
- 统一由一个 `packageVersion.ts` 或生成文件注入

更进一步的推荐：

- 对普通 kernel/ui/module 来说，`module.version` 可以直接使用包版本
- 对 assembly 模块来说，`module.version` 应与 `assemblyVersion` 保持一致

核心原则：

**不要在源码中到处手写 `'0.0.1'`。**

---

## 7. 你现在最适合采用的发布策略

你的场景最适合两条发布线并存。

---

### 7.1 发布线一：安装包发布线（Assembly Release）

适用场景：

- Android / Electron 原生能力改动
- Adapter 改动
- TurboModule 改动
- RN 宿主能力改动
- 打包方式改动
- 本地数据库结构变化
- Hermes/Fabric/原生桥行为变化

#### 流程

1. 选择要发布的 assembly
2. 提升 `assemblyVersion`
3. 自动生成新的 `buildNumber`
4. 生成或更新 `release.manifest.json`
5. 运行类型检查 / 测试 / 打包
6. 产出安装包（APK / Electron 安装包）
7. 记录 git tag
8. 上传构建产物
9. 发布到对应环境 / 渠道

#### 结果

得到的是：

- 一个新的安装包版本
- 对应一个新的 runtime 基线

---

### 7.2 发布线二：OTA 发布线（Bundle Release）

适用场景：

- 纯 JS 代码变更
- kernel/ui/module 逻辑变更
- 不涉及原生代码和宿主变更

#### 流程

1. 选择目标 assembly
2. 从当前 `assemblyVersion` 读取 runtime 基线
3. 提升 `bundleVersion`
4. 收集本次受影响的 workspace 包版本
5. 生成 bundle 清单
6. 构建整套 JS bundle
7. 上传到 OTA 平台或内部热更新服务
8. 绑定 channel / 灰度策略
9. 观察指标，必要时回滚

#### 结果

得到的是：

- 一个新的 JS bundle 发布包
- 不需要用户重装应用

---

## 8. 环境、渠道、灰度应该怎么设计

你选择了 `B1`，说明需要多环境和灰度。

这是非常正确的。

建议用 **channel 模型**，不要靠人工口头约定。

### 8.1 推荐 channel

至少定义：

- `dev`
- `test`
- `staging`
- `production`

如果后面需要灰度，可以再加：

- `production-gray-01`
- `production-gray-02`
- `store-group-a`
- `device-model-x`

---

### 8.2 为什么一定要 channel 化

因为 OTA 的本质就是：

- 不同设备，不一定拿到同一个 bundle
- 不同环境，不应该连到同一个更新流

如果没有 channel，后面你会遇到这些问题：

- 测试包误拿到生产更新
- 部分门店要灰度，结果全量推了
- 某个机型有问题，无法定向停更
- 回滚时找不到正确人群

所以 channel 一定要进入发布元数据。

---

### 8.3 推荐发布目标维度

热更新发布时，至少支持这些目标条件：

- `channel`
- `runtimeVersion`
- `minSupportedAppVersion`
- `maxSupportedAppVersion`
- 可选：`deviceModel`
- 可选：`storeGroup`
- 可选：`tenant`

也就是说，热更新不是“发给所有人”，而是“发给一类符合条件的设备”。

---

## 9. 版本号应该怎么自动化，才能减少人工工作量

这是你最关心的点之一：**到底在哪里配置版本，才能最省心？**

我的答案是：

### 9.1 只允许人工改一个地方

对每个 assembly 来说，发布时只允许人工修改：

- `release.manifest.json`

更准确一点：

- 平时人工甚至不直接手改文件
- 而是通过脚本命令改

例如：

```bash
corepack yarn release:assembly:version --app assembly-android-mixc-retail-rn84v2 --version 2.3.0
corepack yarn release:bundle:bump --app assembly-android-mixc-retail-rn84v2 --channel production
```

脚本自动完成：

- 更新 `release.manifest.json`
- 更新 `package.json version`
- 更新 Android `versionName/versionCode`
- 更新 Electron version
- 生成运行时注入文件

---

### 9.2 不要再手工改这些地方

后面要尽量避免人工直接修改：

- `4-assembly/*/package.json` 的 `version`
- `android/app/build.gradle` 的 `versionCode`
- `android/app/build.gradle` 的 `versionName`
- `src/index.ts` 里的模块 `version: '0.0.1'`
- Electron preload/main 里手写 appVersion

都应该由脚本或生成文件统一同步。

---

### 9.3 推荐新增版本脚本目录

建议在根目录新增：

- `scripts/release/`

里面至少包含：

- `sync-assembly-version.ts`
- `bump-bundle-version.ts`
- `sync-android-version.ts`
- `sync-electron-version.ts`
- `generate-release-manifest.ts`
- `collect-affected-packages.ts`
- `create-release-tag.ts`

这样以后发布就不是“记住很多步骤”，而是“执行标准命令”。

---

## 10. CI/CD 要不要上

答案是：**要。**

而且越早越好。

但不要一开始就搞得非常复杂，可以分三阶段。

---

### 10.1 第一阶段：先把本地发布脚本做标准化

先不要急着全自动发版，先把下面这些命令标准化：

- `release:assembly:prepare`
- `release:assembly:android`
- `release:assembly:electron`
- `release:bundle:prepare`
- `release:bundle:publish`
- `release:manifest:check`

这一步解决的是：

- 人工容易忘步骤
- 多处版本同步容易出错
- 同样的事每次做法不一样

---

### 10.2 第二阶段：CI 接管检查与构建

CI 可以选：

- GitHub Actions
- GitLab CI
- Jenkins
- 任何你团队熟悉的都行

对你来说，核心不是平台，而是流程。

CI 至少应该做这些：

1. 校验版本合法性
2. 校验 `buildNumber` 单调递增
3. 校验 `bundleVersion` 未重复
4. 校验 `runtimeVersion` 是否有效
5. 运行 type-check
6. 运行测试
7. 构建产物
8. 输出构建报告
9. 生成发布记录

---

### 10.3 第三阶段：CI 接管正式发布

后面成熟后，再让 CI 接管：

- 自动上传 APK / Electron 安装包
- 自动上传 OTA bundle
- 自动创建 release note
- 自动打 git tag
- 自动发测试环境
- 生产环境增加人工审批
- 支持灰度发布与一键回滚

---

## 11. 最专业的发布过程应该是什么样

下面是我建议你最终追求的标准流程。

---

### 11.1 安装包发布（标准版）

#### 第一步：创建发布分支

例如：

- `release/android-mixc-retail/2.3.0`

#### 第二步：执行版本脚本

例如：

```bash
corepack yarn release:assembly:prepare --app assembly-android-mixc-retail-rn84v2 --version 2.3.0 --channel production
```

脚本负责：

- 更新 assembly manifest
- bump buildNumber
- 同步 Android / Electron / package 版本
- 记录当前依赖包版本

#### 第三步：CI 校验

- type-check
- test
- build
- release manifest 检查

#### 第四步：生成构建物

- Android APK/AAB
- Electron 安装包

#### 第五步：打标签

例如：

- `assembly/android/mixc-retail-rn84v2/v2.3.0+build.2030007`

#### 第六步：归档

归档内容建议包括：

- 构建产物
- release manifest
- git commit
- 依赖包版本快照
- 构建日志

---

### 11.2 OTA 发布（标准版）

#### 第一步：确认本次不涉及原生变更

如果涉及原生能力改动，不能走 OTA，必须走安装包发布。

#### 第二步：执行版本脚本

例如：

```bash
corepack yarn release:bundle:prepare --app assembly-android-mixc-retail-rn84v2 --channel production
```

脚本负责：

- bump `bundleVersion`
- 记录本次涉及的 workspace 包及版本
- 生成 bundle manifest

#### 第三步：构建 JS bundle

- 按目标 assembly 构建 bundle
- 产出 source map
- 产出资源清单

#### 第四步：上传 OTA 平台

绑定：

- `runtimeVersion`
- `channel`
- `minSupportedAppVersion`
- 灰度条件

#### 第五步：逐步放量

例如：

- 内测 5%
- 灰度 20%
- 全量 100%

#### 第六步：回滚机制

如果发现问题：

- 停止本次 bundle 发布
- 将流量切回上一版 bundle

这也是为什么 `bundleVersion` 必须独立存在。

---

## 12. 你的工程里现在有哪些地方需要后续逐步收敛

结合你当前代码，我认为后续最需要收敛的地方有这些。

### 12.1 `src/index.ts` 中的硬编码模块版本

当前很多包里还是：

```ts
version: '0.0.1'
```

这应该逐步改成：

- 从生成文件导入
- 或从包版本同步生成

---

### 12.2 Android `build.gradle` 手工维护版本

现在：

- `versionCode 1`
- `versionName "1.0"`

后面应改为构建脚本自动注入。

---

### 12.3 `4-assembly` 缺少单一发布清单

目前 assembly 有自己的 `package.json version`，但缺少一份真正面向交付的 release manifest。

这会导致：

- Android、Electron、OTA 三条线无法统一描述
- 出问题时排查困难

---

### 12.4 缺少显式 runtimeVersion 设计

你的项目平台多、宿主多、RN 版本也不完全单一，这种情况下如果没有 runtimeVersion，未来 OTA 一定会踩坑。

---

## 13. 我给你的最终实施建议（从易到难）

为了让你能落地，不建议一次做太大，可以分三步走。

### 第一步：先建立“版本真相源”

先做这三件事：

1. 为每个 `4-assembly` 新增 `release.manifest.json`
2. 约定 `assemblyVersion / buildNumber / bundleVersion / runtimeVersion`
3. 约定所有发布都以 manifest 为准

这一步做完，版本体系就开始稳了。

---

### 第二步：做版本同步脚本

先实现：

- manifest → Android `versionName/versionCode`
- manifest → Electron `package.json version`
- manifest → 运行时注入版本文件

这一步做完，就能明显减少人工工作量。

---

### 第三步：做 CI 发布流水线

最后再补：

- 自动校验
- 自动打包
- 自动归档
- 自动 tag
- 自动灰度发布

这一步做完，发布过程就真正专业化了。

---

## 14. 最后给小白的一个终极记忆口诀

你以后可以这样记：

- **壳版本**：装什么
- **Bundle 版本**：跑什么
- **包版本**：改了什么

更完整一点：

- `assemblyVersion`：用户安装的版本
- `buildNumber`：机器识别的安装包编号
- `bundleVersion`：线上 JS 热更新版本
- `runtimeVersion`：这个 bundle 能给谁用
- `package version`：研发追踪哪个包改了

如果你始终把这五个角色分清楚，版本体系就不会乱。

---

## 15. 推荐的后续落地任务清单

建议你后面按这个顺序做：

1. 为每个 `4-assembly` 设计 `release.manifest.json`
2. 收敛 `assemblyVersion/buildNumber/bundleVersion/runtimeVersion` 字段
3. 写版本同步脚本
4. 去掉源码里散落的硬编码版本号
5. 补充 release CLI
6. 再接 CI/CD
7. 最后接入 OTA 平台和灰度策略

---

## 16. 这套方案的最终结论

如果问“对你这个项目最专业的做法是什么”，我的最终结论是：

- **根目录负责统一依赖版本，不负责交付版本**
- **`4-assembly` 负责最终安装包主版本**
- **OTA 采用整套 JS bundle 独立版本**
- **workspace 包保留各自版本，作为研发追踪版本**
- **每个 assembly 必须有一份 `release.manifest.json` 作为发布真相源**
- **Android / Electron / 运行时版本信息全部从 manifest 自动同步**
- **发布流程拆成“安装包发布线”和“OTA 发布线”**
- **环境、灰度、分组必须通过 channel + runtimeVersion 管控**
- **CI/CD 要有，但可以分阶段接入，不要一口吃成胖子**

这套方式不是最花哨的，但对你现在的架构来说，是最稳、最专业、最容易持续演进的。
