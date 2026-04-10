# workspace-package-scaffolder 仓库专用 skill 规范

## 1. 文档目标

本文档定义一个仓库专用 skill：

- `workspace-package-scaffolder`

该 skill 用于在当前 monorepo 中创建新包骨架，并自动遵守仓库的统一结构、分层约束与版本接入规则。

本 skill 的目标不是生成完整业务实现，而是提供稳定、可重复、分层正确的包脚手架能力。

---

## 2. skill 定位

### 2.1 它要解决的问题

当前仓库新建包时存在以下重复劳动：

- 手工创建目录骨架
- 手工创建 `src/index.ts`
- 手工创建 `src/generated/packageVersion.ts`
- 手工创建 `test/index.ts`
- 手工补 `features/{commands,actors,slices}`
- 手工记忆不同层级的特殊规则

这个 skill 的职责就是把这些重复劳动标准化。

### 2.2 它不解决的问题

这个 skill 不负责：

- 自动写完整业务逻辑
- 自动决定架构边界
- 自动注册所有上游依赖
- 自动迁移旧包实现
- 自动补完整发布链
- 自动补 assembly 全套 release 体系

它只负责：

- 建对目录
- 建对入口
- 建对占位文件
- 接对版本
- 守住分层规则

---

## 3. 推荐名称与触发描述

### 3.1 名称

推荐 skill 名称：

- `workspace-package-scaffolder`

### 3.2 description 建议

建议写成：

> Create and scaffold new packages for this monorepo with the repo’s required structure, version-file wiring, and layer-specific rules. Use this whenever the user asks to create, initialize, scaffold, add, or start a new package under `1-kernel`, `2-ui`, `3-adapter`, `4-assembly`, or `0-mock-server`, even if they only say things like “建个新包”, “加一个 package”, “初始化骨架”, or “先搭目录结构”.

这样可以稳定触发以下场景：

- “帮我建一个新包”
- “先搭目录结构”
- “初始化一个 kernel 包”
- “在 1-kernel/1.1-base 下新建 contracts 包”
- “给 0-mock-server 加个新宿主包”

---

## 4. skill 的作用范围

这个 skill 只针对当前仓库结构，优先支持以下分层：

- `1-kernel`
- `2-ui`
- `3-adapter`
- `4-assembly`
- `0-mock-server`

其中第一优先级是：

- `1-kernel/1.1-base/*`
- `0-mock-server/*`

因为这两类目录是当前基础架构重构最频繁的新包创建位置。

补充要求：

该 skill 不应只生成“统一空骨架”，还应逐步体现：

1. 新基础包之间的职责差异。
2. 旧 `base / interconnection` 中必须继承的统一 runtime、command 主语、上下文语言、低接入成本等工程价值。
3. 新架构中必须显式化的协议边界。

---

## 5. 输入模型

skill 推荐接受以下输入：

### 5.1 必填输入

- `target_path`
  - 例如：
    - `1-kernel/1.1-base/contracts`
    - `1-kernel/1.1-base/topology-runtime`
    - `0-mock-server/dual-topology-host`

- `package_name`
  - 例如：
    - `@impos2/kernel-base-contracts`
    - `@impos2/dual-topology-host`

### 5.2 推荐输入

- `package_role`
  - 枚举：
    - `kernel`
    - `ui`
    - `adapter`
    - `assembly`
    - `mock-server`

- `package_kind`
  - 枚举：
    - `contracts`
    - `registry`
    - `ports`
    - `runtime`
    - `module`
    - `host`
    - `service`
    - `generic`

- `description`
- `needs_test_entry`

### 5.3 自动推断规则

如未显式提供，允许通过路径自动推断：

- 路径以 `1-kernel/` 开头 -> `package_role = kernel`
- 路径以 `2-ui/` 开头 -> `package_role = ui`
- 路径以 `3-adapter/` 开头 -> `package_role = adapter`
- 路径以 `4-assembly/` 开头 -> `package_role = assembly`
- 路径以 `0-mock-server/` 开头 -> `package_role = mock-server`

### 5.4 强制规则

对于 `1-kernel`：

- `needs_react = false`

不允许被用户输入覆盖。

并且脚手架在生成 `1-kernel/1.1-base/*` 包时，应默认体现以下继承要求：

1. 保留统一 runtime 思想
2. 保留 command 作为系统主语
3. 保留统一上下文语言
4. 不重新引入 React 或全局 manager 风格占位

---

## 6. 输出模型

skill 输出分为两类：

### 6.1 文件输出

- 创建目录骨架
- 创建最小入口文件
- 创建版本接入文件
- 创建占位文件

### 6.2 文本报告

skill 完成后必须汇报：

1. 创建了哪些目录
2. 创建了哪些文件
3. 哪些文件只是占位
4. 哪些后续需要人工补充
5. 是否需要执行版本生成脚本

---

## 7. 通用目录骨架规则

### 7.1 统一骨架

适用于 `1-kernel / 2-ui / 4-assembly` 的标准骨架：

- `src/application/index.ts`
- `src/features/commands/index.ts`
- `src/features/actors/index.ts`
- `src/features/slices/index.ts`
- `src/foundations/index.ts`
- `src/selectors/index.ts`
- `src/hooks/index.ts`
- `src/supports/index.ts`
- `src/types/index.ts`
- `src/generated/packageVersion.ts`
- `src/index.ts`
- `test/index.ts`
- `package.json`

统一骨架只解决结构统一，不代表所有包都应生成同一种占位内容。

补充规则：

- `src/foundations` 是实现层目录，不等于必须在包根入口整体公开。
- 包根入口只显式导出稳定公共 API；包内测试可以通过相对路径读取内部实现。
- 默认不生成 `src/features/middlewares` 与 `src/features/epics`。

对 `1-kernel/1.1-base/*`，脚手架后续必须支持“统一骨架 + 包级差异 profile”模式，而不是 7 个包都只有同样的空白入口。

### 7.2 mock-server 骨架

适用于 `0-mock-server/*`：

- `src/runtime/index.ts`
- `src/types/index.ts`
- `src/generated/packageVersion.ts`
- `src/index.ts`
- `test/index.ts`
- `package.json`

### 7.3 host/service 类 mock-server 扩展骨架

当 `package_role = mock-server` 且 `package_kind = host | service` 时，推荐额外生成：

- `src/runtime/createDualTopologyHost.ts`
- `src/runtime/runtimeDeps.ts`
- `test/helpers/*.ts`
- `test/scenarios/*.spec.ts`

### 7.4 `1-kernel/1.1-base` 七包 profile 方向

`1-kernel/1.1-base` 的基础包必须共享统一目录结构，但脚手架后续应按职责生成差异化占位文件。

目标方向如下：

1. `contracts`
   - 更偏协议对象、公开类型、上下文语言、module contract、protocol version。
2. `definition-registry`
   - 更偏 registry factory、definition query、descriptor register。
3. `platform-ports`
   - 更偏 port interface、port container、host capability contract。
4. `execution-runtime`
   - 更偏 command runtime、execution context、journal、middleware。
5. `state-runtime`
   - 更偏 Redux state runtime、持久化、property 级同步与恢复。
6. `transport-runtime`
   - 更偏 http/ws runtime、transport adapter、channel/session abstraction。
7. `topology-runtime`
   - 更偏 owner-ledger、route planner、compatibility、projection builder。
8. `topology-client-runtime`
   - 更偏 topology client state、selectors、client runtime module。
9. `host-runtime`
   - 更偏 host shell、relay/session contract、fault model。
10. `runtime-shell`
   - 更偏 runtime assembly、selector 暴露、projection state、统一入口。

这一步的目的不是提前写完整实现，而是让脚手架从一开始就体现“包边界不同、未来实现方向不同”。

---

## 8. 分层特殊规则

### 8.1 `1-kernel`

强制规则：

- 不依赖 React
- `src/hooks/index.ts` 只放规则说明
- 不生成真实 React hooks

建议的 `hooks/index.ts` 模板：

```ts
/**
 * Kernel layer rule:
 * - do not depend on React here
 * - do not implement React hooks in 1-kernel
 * - keep this file only as a rule marker and export placeholder
 */
export {}
```

### 8.2 `2-ui`

规则：

- 可保留 `hooks` 占位
- 不默认生成具体 UI hooks
- 不默认生成组件代码

### 8.3 `3-adapter`

规则：

- 保持目录骨架尽量统一
- 不自动生成平台实现细节
- 若路径处于 Android / Electron 子树，允许根据宿主类型调整 `scripts`

### 8.4 `4-assembly`

规则：

- 可以生成标准骨架
- 版本提示必须指向 `releaseInfo`
- 不自动伪造完整 `release.manifest.json`

对于 assembly 类型包，`src/index.ts` 中应写注释提醒：

- assembly 运行时版本应来自 `src/generated/releaseInfo.ts`

### 8.5 `0-mock-server`

规则：

- 不生成 React 相关内容
- 结构偏服务端
- `host/service` 类型优先生成 `src/runtime/*`、`test/scenarios/*`、`test/helpers/*`

对于 `dual-topology-host`，脚手架还应体现：

1. pair host 语义
2. host shell / server / runtimeDeps 这些服务端职责面
3. host 不承担 owner-ledger 与 request 真相判定

---

## 9. 版本接入规则

本 skill 必须遵守 [终端版本管理说明.md](/Users/dexter/Documents/workspace/idea/newPOSv1/终端版本管理说明.md)。

### 9.1 package version

默认创建：

- `src/generated/packageVersion.ts`

内容为：

```ts
export const packageVersion = '0.0.1'
```

如果后续由统一脚本覆盖，也允许在 skill 实现中将该文件作为占位生成物。

### 9.2 `src/index.ts`

所有普通包都必须默认接入：

```ts
import {packageVersion} from './generated/packageVersion'
```

并对外暴露最小版本出口。

对于 `contracts`，后续脚手架还应支持显式接入 `protocolVersion` 入口占位。

### 9.3 assembly 特例

assembly 包不应直接使用 `packageVersion` 作为最终运行时版本来源。

应在注释中提示：

- 最终 assembly 运行时版本应来自 `releaseInfo`

---

## 10. `package.json` 生成规则

### 10.1 最小字段

默认生成：

- `name`
- `version`
- `private`
- `scripts`

### 10.2 最小 scripts

建议默认包含：

- `type-check`
- `test`

不自动填充与当前包无关的大量脚本。

### 10.3 不自动生成的内容

不自动写：

- 大量依赖
- 复杂 build 配置
- monorepo 全量联动脚本

---

## 11. `src/index.ts` 生成规则

### 11.1 通用要求

必须满足：

- 引入 `packageVersion`
- 导出最小公共入口
- 保留后续补实现的位置
- 不默认把内部 `features/slices`、`features/actors` 当成公开 API
- 不默认把 `src/foundations` 整体当成公共 API

### 11.2 kernel/module 类包

必须默认包含：

- `moduleName` 常量
- `version` 占位
- 分层导出入口

### 11.3 contracts/registry/ports 类包

建议默认偏轻，但仍必须包含 `moduleName`：

- 只暴露公开导出
- 不伪造 runtime/module 结构

### 11.4 公开读写边界

脚手架必须默认体现下面规则：

1. store state 可以全局读取。
2. selector 是稳定公开读接口。
3. command 是稳定公开写接口。
4. slice action 不作为跨包公开写接口导出。
5. `src/foundations` 只允许把经过审查的稳定能力显式导出到包根入口。
6. 包内测试允许通过相对路径读取内部实现，而不是为了测试扩大公共 API。

---

## 12. skill 推荐实现方式

## 12.1 推荐方案

推荐采用：

- 模板 + 脚本驱动

即：

- `SKILL.md` 负责说明什么时候用、怎么选模板
- `scripts/scaffold_package.py` 或 `scripts/scaffold_package.ts` 负责真正落盘
- `assets/templates/` 提供模板文件

### 12.2 不推荐方案

不推荐纯文本指令式脚手架，因为：

- 每次输出细节容易漂移
- 文件内容一致性差
- 版本接入容易漏

---

## 13. 推荐 skill 目录结构

建议 skill 目录结构如下：

```text
workspace-package-scaffolder/
├── SKILL.md
├── references/
│   ├── structure-rules.md
│   ├── layer-rules.md
│   └── versioning-rules.md
├── assets/
│   └── templates/
│       ├── common/
│       ├── kernel/
│       ├── mock-server/
│       └── assembly/
└── scripts/
    └── scaffold_package.py
```

### 13.1 `references/structure-rules.md`

职责：

- 统一目录结构规则
- `features` 子目录规则

### 13.2 `references/layer-rules.md`

职责：

- kernel 不依赖 React
- hooks/index.ts 规则
- assembly 使用 releaseInfo 的提示
- mock-server 服务端结构约束

### 13.3 `references/versioning-rules.md`

职责：

- 提炼当前仓库版本管理规则
- 说明 `packageVersion` 与 `releaseInfo` 的边界

### 13.4 `scripts/scaffold_package.py`

职责：

- 校验目标路径
- 创建目录
- 渲染模板
- 生成占位文件
- 输出报告

---

## 14. 安全与幂等要求

### 14.1 目标路径检查

创建前必须检查：

- 目标路径是否已存在

默认行为：

- 已存在则不直接覆盖
- 汇报冲突并等待进一步指令

### 14.2 占位文件标记

所有占位文件必须通过注释或报告明确告知用户：

- 这是脚手架占位
- 不是完整实现

### 14.3 幂等性

对于重复执行同一脚手架命令，应尽量做到：

- 不破坏已有文件
- 不重复创建冲突目录

---

## 15. success criteria

第一版 skill 达到以下目标即可视为可用：

1. 能为 `1-kernel/1.1-base/*` 正确创建新包。
2. 能为 `0-mock-server/dual-topology-host` 正确创建服务端骨架。
3. 自动接入 `packageVersion`。
4. 自动写入 `1-kernel/src/hooks/index.ts` 的禁止 React 规则。
5. 不生成与仓库分层规则冲突的内容。
6. `1-kernel/1.1-base` 的 7 个包逐步支持差异化 profile，而不是统一空壳。

---

## 16. 推荐演进路线

### 16.1 第一版

支持：

- `1-kernel`
- `0-mock-server`

优先场景：

- `1-kernel/1.1-base/*`
- `0-mock-server/dual-topology-host`

### 16.2 第二版

补充支持：

- `2-ui`
- `4-assembly`

---

## 17. 脚手架的设计底线

这个 skill 后续扩展时，必须始终遵守下面底线：

1. 不能为了追求统一，把所有基础包生成成同质空壳。
2. 不能因为只做脚手架，就忽略旧架构中必须继承的统一语言和统一 runtime 价值。
3. 不能在脚手架里重新引入旧式全局 manager、全局 store、全局 register slot 作为默认占位模式。
4. 不能把 request 真相、projection、transport、topology 混成一个泛化模板。

换句话说：

脚手架虽然不写完整业务实现，但它必须从结构和占位命名层面，就把新架构导向正确方向。
- `3-adapter`

### 16.3 第三版

补充能力：

- 自动添加 workspace 依赖
- 自动补充更细的模板变体
- 自动生成确定性的 `moduleName` / runtime 占位结构

---

## 17. 结论

`workspace-package-scaffolder` 应被定义为一个仓库专用、窄职责、高一致性的 skill。

它不负责“智能生成业务代码”，而负责：

- 统一骨架
- 统一版本接入
- 统一层级约束
- 降低新基础包创建时的人为偏差

对于当前核心基础包重构，这个 skill 会直接提高：

- 新包创建效率
- 结构一致性
- 分层纪律
- 后续批量重构的稳定性
