# Mock Terminal Platform 手动控制台与基础资料设计方案

## 1. 文档背景

当前 `0-mock-server/mock-terminal-platform` 已具备以下能力：

- 支持沙箱化运行与切换
- 支持 TCP / TDP / 场景 / 故障注入的基础联调能力
- 支持通过快捷控制台完成批量造数、批量激活码生成、批量下发与链路观察

但当前 TCP 控制面的主要问题是：

1. 偏重“快捷联调”，不利于逐对象理解 TCP 生命周期
2. 缺少基础资料管理能力，业务对象之间的引用关系不够真实
3. 激活码、终端、任务发布、任务实例等对象缺少完整的手动维护入口
4. 页面结构偏堆叠式，不适合教学、开发、调试和端到端验证

本次设计目标，是将平台升级为一个端到端、闭环、可管理、可观测的调试与管理后台。

---

## 2. 设计目标

### 2.1 总体目标

将平台从“快捷联调后台”升级为“主数据 + 控制面 + 观测面”闭环系统，使其同时满足：

- 开发人员理解业务模型
- 测试人员手动构造联调用例
- 架构人员验证控制面与数据面边界
- 调试人员跟踪对象级状态变化与链路结果

### 2.2 关键目标

本次设计重点达成以下目标：

- 新增左侧二级导航结构
- 保留现有 TCP 快捷控制台
- 新增 TCP 手动控制台
- 新增基础资料模块
- 建立 Tenant -> Brand -> Project -> Store 的真实业务层级
- 建立 Profile / Template / Activation Code / Terminal / Release / Instance 的完整控制面模型
- 让所有对象都运行在当前沙箱上下文中
- 提供端到端、逐对象、可穿透的管理与观察体验

### 2.3 设计原则

本次设计遵循以下原则：

1. 对象优先：每种实体都要有清晰的列表、表单、详情和状态
2. 关系可见：每个对象都应能看到其依赖对象和下游对象
3. 链路可追：从基础资料到 TCP，再到 TDP，应能完整追踪
4. 沙箱隔离：所有主数据、控制面数据、观测数据都必须随沙箱隔离
5. 双模式共存：快捷控制台与手动控制台长期共存，不互相替代
6. 结构优先于捷径：不以一键动作替代显式状态推进

---

## 3. 导航结构设计

### 3.1 一级导航

建议后台左侧一级导航调整为：

- 总览
- TCP 控制面
- TDP 数据面
- 场景引擎
- 故障注入
- 基础资料
- 沙箱管理

### 3.2 TCP 二级导航

`TCP 控制面` 下新增二级导航：

- 快捷控制台
- 手动控制台

含义如下：

- 快捷控制台：保留现有页面，承担批量造数、快捷下发、快速联调职责
- 手动控制台：面向对象生命周期管理、手工维护、逐步调试

### 3.3 基础资料模块定位

`基础资料` 为独立一级导航，不挂在 TCP 手动控制台内。

原因：

- 基础资料不是 TCP 附属功能，而是整个平台的主数据层
- 基础资料将被 TCP、场景、故障、统计、导出等多个模块共同引用
- 将其独立有利于形成企业后台常见的“主数据中心”结构

---

## 4. 领域模型设计

### 4.1 业务主数据层级

本方案将“商场”统一收敛为 `Project` 概念，业务层级定义为：

- Tenant
- Brand
- Project
- Store

层级关系为：

- Tenant 下可有多个 Brand
- Brand 下可有多个 Project
- Project 下可有多个 Store

### 4.2 终端模型对象

在业务主数据之上，定义终端模型对象：

- Terminal Profile
- Terminal Template

其职责为：

- Profile：描述终端硬件 / 能力模型
- Template：描述基于 Profile 的默认配置模板

### 4.3 TCP 控制面对象

控制面核心对象为：

- Activation Code
- Terminal Instance
- Task Release
- Task Instance

对象关系为：

- Activation Code 引用 Store、Profile、Template
- Terminal Instance 由激活码激活或手工创建产生
- Task Release 表示一次治理动作
- Task Instance 表示某次治理动作在终端维度的执行单元

### 4.4 观测与调试对象

观测层对象包括：

- Session
- Topic
- Projection
- Change Log
- Fault Rule
- Scene Template
- Audit Log

其职责为：

- 展示数据面投递和变更结果
- 展示异常注入效果
- 支撑链路追踪与问题排查

### 4.5 沙箱关系

所有对象都必须属于当前沙箱：

- 主数据：Tenant / Brand / Project / Store
- 终端模型：Profile / Template
- 控制面：Activation Code / Terminal / Release / Instance
- 观测层：Topic / Projection / Change Log / Fault / Audit / Session

这意味着：

- 切换沙箱后，用户看到的是另一套完整业务世界
- 从已有沙箱复制基础数据时，复制的是主数据与配置数据，而不是运行态

---

## 5. 基础资料模块设计

### 5.1 模块职责

基础资料模块承担平台主数据维护职责，为 TCP 手动控制台和其他模块提供真实引用来源。

### 5.2 Tab 结构

建议基础资料模块包含以下 Tab：

- 租户
- 品牌
- 项目
- 门店
- 终端 Profile
- 终端 Template

### 5.3 租户（Tenant）

#### 列表字段

- 名称
- 编码
- 状态
- 描述
- 更新时间
- 品牌数量
- 项目数量
- 门店数量

#### 表单字段

- tenantCode
- tenantName
- status
- description

#### 详情内容

- 基础信息
- 关联品牌列表
- 关联项目统计
- 关联门店统计
- 最近审计日志

#### 操作

- 新建
- 编辑
- 启用 / 停用
- 查看详情

### 5.4 品牌（Brand）

#### 列表字段

- 名称
- 编码
- 所属租户
- 状态
- 描述
- 更新时间
- 项目数量
- 门店数量

#### 表单字段

- brandCode
- brandName
- tenantId
- status
- description

#### 详情内容

- 基础信息
- 所属 Tenant
- 关联 Project 列表
- 关联 Store 统计
- 最近审计日志

#### 操作

- 新建
- 编辑
- 启用 / 停用
- 查看详情

### 5.5 项目（Project）

#### 列表字段

- 名称
- 编码
- 所属品牌
- 所属租户
- 状态
- 描述
- 更新时间
- 门店数量
- 终端数量

#### 表单字段

- projectCode
- projectName
- brandId
- status
- description
- region（可选）
- timezone（可选）

#### 详情内容

- 基础信息
- 所属 Brand / Tenant
- 关联 Store 列表
- 关联终端统计
- 关联任务统计
- 最近审计日志

#### 操作

- 新建
- 编辑
- 启用 / 停用
- 查看详情

### 5.6 门店（Store）

#### 列表字段

- 名称
- 编码
- 所属项目
- 所属品牌
- 所属租户
- 状态
- 更新时间
- 激活码数量
- 终端数量

#### 表单字段

- storeCode
- storeName
- projectId
- status
- description
- address（可选）
- contactName（可选）
- contactPhone（可选）

#### 详情内容

- 基础信息
- 所属 Project / Brand / Tenant
- 关联 Activation Code
- 关联 Terminal Instance
- 关联任务统计
- 最近审计日志

#### 操作

- 新建
- 编辑
- 启用 / 停用
- 查看详情

### 5.7 终端 Profile

#### 列表字段

- 名称
- 编码
- 状态
- 能力摘要
- 默认 App 版本
- 更新时间
- 被 Template 引用次数
- 被终端引用次数

#### 表单字段

- profileCode
- profileName
- status
- description
- defaultAppVersion
- capabilitiesJson

#### 详情内容

- 基础信息
- 能力 JSON
- 被哪些 Template 使用
- 被哪些终端使用

#### 操作

- 新建
- 编辑
- 启用 / 停用
- 查看详情

### 5.8 终端 Template

#### 列表字段

- 名称
- 编码
- 关联 Profile
- 状态
- 默认标签
- 更新时间
- 被激活码引用次数
- 被终端引用次数

#### 表单字段

- templateCode
- templateName
- profileId
- status
- description
- presetConfigJson
- presetTagsJson
- defaultBundleVersion（可选）
- defaultConfigVersion（可选）

#### 详情内容

- 基础信息
- 关联 Profile
- 配置 JSON
- Tags
- 被哪些激活码 / 终端引用

#### 操作

- 新建
- 编辑
- 启用 / 停用
- 查看详情

### 5.9 统一交互规则

所有基础资料实体统一遵循以下规则：

- 支持关键字搜索
- 支持状态筛选
- 支持详情抽屉
- 支持新建 / 编辑
- 第一版不做物理删除，只做启用 / 停用
- 停用状态在引用表单中不可选
- 按最近更新时间倒序展示

---

## 6. TCP 手动控制台设计

### 6.1 模块目标

TCP 手动控制台用于逐对象维护 TCP 生命周期中的核心对象，支持手工推进流程和链路调试。

### 6.2 Tab 结构

建议手动控制台包含以下 Tab：

- 终端模型
- 激活管理
- 终端实例
- 任务发布
- 任务实例
- 链路追踪

### 6.3 终端模型

该 Tab 在 TCP 中以“只读摘要 + 快捷跳转”为主，不作为主维护入口。

#### 展示内容

- 当前沙箱 Profile 列表
- 当前沙箱 Template 列表
- 当前选中对象详情
- 跳转到基础资料按钮

#### 设计原则

- 主维护入口在基础资料
- TCP 内只做引用预览与快速跳转
- 避免同一对象双入口编辑导致混乱

### 6.4 激活管理

#### 目标

- 单个创建激活码
- 查看和筛选激活码
- 作废激活码
- 使用激活码执行模拟激活

#### 列表字段

- 激活码
- 状态
- Tenant
- Brand
- Project
- Store
- Profile
- Template
- 过期时间
- 创建时间
- 已绑定终端
- 操作

#### 表单字段

- storeId
- profileId
- templateId
- expiresInDays
- remark（可选）

说明：

- Tenant / Brand / Project 由 Store 自动反推展示
- 不建议人工重复填写组织链路字段

#### 详情内容

- 激活码基础信息
- 组织归属
- 引用 Profile / Template
- 当前状态
- 若已使用，展示关联 Terminal 和使用时间

#### 操作

- 新建激活码
- 作废激活码
- 模拟激活
- 查看详情

### 6.5 终端实例

#### 目标

- 查看终端实例
- 支持从激活码激活生成终端
- 支持直接手工创建终端
- 支持状态维护与详情观察

#### 列表字段

- terminalId
- Store
- Project
- Brand
- Profile
- Template
- 生命周期状态
- 在线状态
- 健康状态
- App 版本
- Bundle 版本
- Config 版本
- 更新时间
- 操作

#### 表单模式

- 从激活码生成
- 直接手工创建

#### 手工创建字段

- storeId
- profileId
- templateId
- deviceFingerprint
- deviceInfoJson
- appVersion
- bundleVersion
- configVersion
- lifecycleStatus
- presenceStatus
- healthStatus

#### 详情内容

- 基础信息
- 设备信息
- 激活来源
- 当前凭证摘要
- 关联任务实例
- 快照与变更入口

#### 操作

- 创建终端
- 强制在线 / 离线
- 修改健康状态
- 修改生命周期状态
- 查看详情
- 跳转链路追踪

### 6.6 任务发布

#### 目标

- 手动创建发布单
- 明确区分草稿、审批、生成实例、投递四个阶段
- 帮助用户理解控制面流程

#### 列表字段

- releaseId
- 标题
- 任务类型
- sourceType
- sourceId
- 优先级
- 状态
- 审批状态
- 目标数量
- 更新时间
- 操作

#### 表单字段

- title
- taskType
- sourceType
- sourceId
- priority
- targetTerminalIds
- payloadJson

#### 详情内容

- 基础信息
- 目标终端列表
- payload
- 已生成实例数量
- 投递结果摘要

#### 操作

- 创建发布单
- 审批发布单
- 生成任务实例
- 投递到 TDP
- 查看关联任务实例

### 6.7 任务实例

#### 目标

- 查看终端维度任务实例
- 推进任务状态
- 写入执行结果与错误信息

#### 列表字段

- instanceId
- releaseId
- terminalId
- taskType
- 状态
- deliveryStatus
- deliveredAt
- finishedAt
- 更新时间
- 操作

#### 详情内容

- 基础信息
- payload
- result
- error
- 来源 Release
- 目标 Terminal
- 关联 Projection / Change Log

#### 操作

- 标记 DELIVERED
- 标记 ACKED
- 标记 FAILED
- 写入 resultJson
- 写入 errorJson
- 查看详情

### 6.8 链路追踪

#### 目标

通过一个任务实例，串起整个 TCP → TDP 链路。

#### 页面结构

建议分块展示：

- Task Instance
- Task Release
- Terminal
- TDP Projection
- TDP Change Log
- Audit Log

#### 展示重点

- 任务从哪里发起
- 发给了谁
- 当前执行到哪一步
- 是否投递成功
- 是否生成 Projection
- 是否记录 Change Log
- 是否存在 Fault Rule 影响

---

## 7. 页面交互流设计

### 7.1 从空沙箱开始的推荐路径

推荐操作路径如下：

1. 进入基础资料
2. 创建 Tenant
3. 创建 Brand
4. 创建 Project
5. 创建 Store
6. 创建 Terminal Profile
7. 创建 Terminal Template
8. 进入 TCP 手动控制台
9. 创建 Activation Code
10. 使用激活码模拟激活
11. 查看 Terminal Instance
12. 创建 Task Release
13. 审批并生成 Task Instance
14. 投递到 TDP
15. 查看 Task Instance
16. 写入任务结果
17. 查看链路追踪

### 7.2 总览页引导

总览页根据当前沙箱数据状态提供下一步引导：

- 没有 Tenant：提示先创建租户
- 没有 Store：提示先完成 Tenant -> Brand -> Project -> Store 建模
- 没有 Profile / Template：提示先创建终端模型
- 没有激活码：提示先创建激活码
- 没有终端：提示使用激活码模拟激活
- 没有任务：提示创建任务发布单
- 没有实例：提示为发布单生成实例
- 没有 TDP 数据：提示投递到 TDP

### 7.3 详情穿透

所有详情页应具备对象间跳转能力，例如：

- Store -> Activation Code / Terminal / Task
- Terminal -> Store / Profile / Template / Task Instance / Snapshot
- Task Release -> Task Instance / Target Terminal
- Task Instance -> Release / Terminal / Projection / Change Log

---

## 8. 数据表设计建议

### 8.1 新增数据表

建议新增以下主数据表：

- tenants
- brands
- projects
- stores

这些表应全部带有 `sandbox_id` 字段，以支持沙箱隔离。

### 8.2 调整现有表

建议对以下表进行增强：

#### terminal_profiles

新增建议字段：

- profile_code
- status

#### terminal_templates

新增建议字段：

- template_code
- status

#### activation_codes

建议补充：

- project_id
- remark（可选）

#### terminal_instances

建议补充：

- project_id
- activation_code（可选，表示来源）

#### task_releases

保留 `target_selector_json`，并在详情展示时做结构化解释。

---

## 9. 接口设计建议

### 9.1 基础资料接口

#### Tenant

- `GET /api/v1/admin/master-data/tenants`
- `POST /api/v1/admin/master-data/tenants`
- `PUT /api/v1/admin/master-data/tenants/:tenantId`
- `GET /api/v1/admin/master-data/tenants/:tenantId`

#### Brand

- `GET /api/v1/admin/master-data/brands`
- `POST /api/v1/admin/master-data/brands`
- `PUT /api/v1/admin/master-data/brands/:brandId`
- `GET /api/v1/admin/master-data/brands/:brandId`

#### Project

- `GET /api/v1/admin/master-data/projects`
- `POST /api/v1/admin/master-data/projects`
- `PUT /api/v1/admin/master-data/projects/:projectId`
- `GET /api/v1/admin/master-data/projects/:projectId`

#### Store

- `GET /api/v1/admin/master-data/stores`
- `POST /api/v1/admin/master-data/stores`
- `PUT /api/v1/admin/master-data/stores/:storeId`
- `GET /api/v1/admin/master-data/stores/:storeId`

#### Profile

- `GET /api/v1/admin/master-data/profiles`
- `POST /api/v1/admin/master-data/profiles`
- `PUT /api/v1/admin/master-data/profiles/:profileId`
- `GET /api/v1/admin/master-data/profiles/:profileId`

#### Template

- `GET /api/v1/admin/master-data/templates`
- `POST /api/v1/admin/master-data/templates`
- `PUT /api/v1/admin/master-data/templates/:templateId`
- `GET /api/v1/admin/master-data/templates/:templateId`

### 9.2 TCP 手动控制台接口

#### 激活管理

- `GET /api/v1/admin/tcp/manual/activation-codes`
- `POST /api/v1/admin/tcp/manual/activation-codes`
- `PUT /api/v1/admin/tcp/manual/activation-codes/:code/revoke`
- `GET /api/v1/admin/tcp/manual/activation-codes/:code`

#### 终端激活

- `POST /api/v1/admin/tcp/manual/terminals/activate`

#### 终端实例

- `GET /api/v1/admin/tcp/manual/terminals`
- `POST /api/v1/admin/tcp/manual/terminals`
- `PUT /api/v1/admin/tcp/manual/terminals/:terminalId/status`
- `GET /api/v1/admin/tcp/manual/terminals/:terminalId`

#### 任务发布

- `GET /api/v1/admin/tcp/manual/task-releases`
- `POST /api/v1/admin/tcp/manual/task-releases`
- `PUT /api/v1/admin/tcp/manual/task-releases/:releaseId/approve`
- `POST /api/v1/admin/tcp/manual/task-releases/:releaseId/generate-instances`
- `POST /api/v1/admin/tcp/manual/task-releases/:releaseId/dispatch`
- `GET /api/v1/admin/tcp/manual/task-releases/:releaseId`

#### 任务实例

- `GET /api/v1/admin/tcp/manual/task-instances`
- `PUT /api/v1/admin/tcp/manual/task-instances/:instanceId/delivery-status`
- `PUT /api/v1/admin/tcp/manual/task-instances/:instanceId/result`
- `GET /api/v1/admin/tcp/manual/task-instances/:instanceId`

#### 链路追踪

- `GET /api/v1/admin/tcp/manual/task-instances/:instanceId/trace`

---

## 10. 前端结构拆分建议

当前前端主要集中于单一 `App.tsx` 文件。为了支持本次后台升级，建议拆分为模块化结构：

### 10.1 导航层

- `web/src/App.tsx`
- `web/src/layouts/AdminShell.tsx`

### 10.2 TCP 模块

- `web/src/features/tcp/QuickConsole.tsx`
- `web/src/features/tcp/ManualConsole.tsx`
- `web/src/features/tcp/tabs/ActivationManager.tsx`
- `web/src/features/tcp/tabs/TerminalManager.tsx`
- `web/src/features/tcp/tabs/ReleaseManager.tsx`
- `web/src/features/tcp/tabs/InstanceManager.tsx`
- `web/src/features/tcp/tabs/TraceViewer.tsx`

### 10.3 基础资料模块

- `web/src/features/master-data/MasterDataPage.tsx`
- `web/src/features/master-data/tabs/TenantManager.tsx`
- `web/src/features/master-data/tabs/BrandManager.tsx`
- `web/src/features/master-data/tabs/ProjectManager.tsx`
- `web/src/features/master-data/tabs/StoreManager.tsx`
- `web/src/features/master-data/tabs/ProfileManager.tsx`
- `web/src/features/master-data/tabs/TemplateManager.tsx`

### 10.4 通用组件

建议补充以下通用组件：

- 对象列表组件
- 对象详情组件
- JSON 输入组件
- 状态标签组件
- 关系引用组件
- 顶部路径引导组件

---

## 11. 实施分期建议

### 11.1 第一期：结构落位

目标：

- 导航结构升级
- 增加基础资料模块入口
- 增加 TCP 手动控制台入口
- 各页面完成布局与信息架构落位

### 11.2 第二期：主数据与控制面闭环

目标：

- 完成基础资料数据表和接口
- 完成激活管理、终端实例、任务发布、任务实例的手动维护接口
- 打通从基础资料到控制面对象的引用关系

### 11.3 第三期：观测增强

目标：

- 增强链路追踪能力
- 增强对象详情穿透
- 增强审计与故障视图联动
- 增强空状态引导和操作建议

---

## 12. 第一轮验收标准

当满足以下条件时，视为第一轮设计目标达成：

1. 左侧导航已支持 TCP 二级导航
2. 快捷控制台完整保留
3. 新增基础资料模块
4. 可在基础资料中维护 Tenant / Brand / Project / Store / Profile / Template
5. 可在 TCP 手动控制台中：
   - 创建激活码
   - 使用激活码模拟激活
   - 查看与维护终端实例
   - 创建任务发布单
   - 生成任务实例
   - 投递到 TDP
   - 写入任务结果
   - 查看链路追踪
6. 所有对象均随当前沙箱隔离
7. 可从空沙箱完整走通一条端到端链路

---

## 13. 结论

本方案的核心价值，不在于简单补几个表单，而在于将 `Mock Terminal Platform` 升级为：

- 有主数据
- 有对象模型
- 有控制面流程
- 有观测链路
- 有沙箱隔离
- 有快捷模式和手动模式双入口

的完整开发与调试后台。

该设计适合分阶段实施，并可在现有项目基础上逐步演进，不需要推翻当前快捷联调能力。
