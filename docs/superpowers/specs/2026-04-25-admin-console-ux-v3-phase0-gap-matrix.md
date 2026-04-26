# Admin Console UX v3 Phase 0 Gap Matrix

> 输入设计：`ai-result/2026-04-25-admin-console-ux-design-v3.md`  
> 执行计划：`.omx/plans/2026-04-25-admin-console-ux-design-v3-implementation-plan.md`  
> 生成时间：2026-04-25  
> 目的：Phase 0 冻结执行边界，防止继续以数据表展示或旧 `/customer` 代码补丁方式实现。

## 1. Phase 0 结论

当前 server 已经有 aligned master-data、business event、projection outbox、publish log、price rule、table、workstation、IAM、合同动作等骨架；但仍存在和 v3 用户旅途明显冲突的点，不能直接宣布 Phase 1 完成。

2026-04-26 最新边界：本轮只做**主数据**。主数据要作为交易和履约的稳定事实底座，必须覆盖组织、合同签署快照、商品/菜单、经营配置、可售/库存基础、IAM 与投影；但不实现订单、支付、预订生命周期、履约工单、开台/结账、接单/拒单、结算执行等运行流程。任何看起来像交易/履约动作的内容，只能作为配置、快照、只读状态或下游依赖说明出现。

前端 `/customer` 当前实现仍有旧问题风险：页面按 super/group 分组而不是 v3 侧栏信息架构；详情/编辑/创建模式混杂；普通页面容易出现重复指标、技术字段主显、表单字段不足。执行时应按新计划重建，不继续在旧结构上局部修。

## 2. v3 硬约束对照

| v3 要求 | 当前观察 | 偏离 | Phase 1/2 处理 |
|--------|----------|------|----------------|
| 所有业务实体携带 `sandbox_id + platform_id`，上下文条始终显示沙箱和平台 | server envelope 有 sandbox/platform；前端 API 有 sandbox header | UI 仍需按 v3 重建上下文条；部分实体数据的 `platform_id` 需要派生/补齐 | Phase 2 壳层；Phase 1 写模型补齐 |
| 门店 tenant/brand 由合同生效写入，不可直接编辑 | `activateContract` 会写 store snapshot；已有 ACTIVE 合同时返回 `STORE_ALREADY_HAS_ACTIVE_CONTRACT`；终止为 `TERMINATED` 并清空 Store 快照 | 后端已对齐；前端仍需把门店合同驱动字段做成只读并解释原因 | Phase 2/3 UI |
| Brand 直属 Platform | service 已有 brand 约束，repair 会删除 tenant_id | UI 不能再显示 brand 属于 tenant | Phase 2/3 文案和表单约束 |
| Tenant 即法人主体，BusinessEntity 不做一等导航 | service 有 business_entity 和 legal-entities API | v3 内部有冲突；不能让业务用户理解技术实体 | Phase 1 保留兼容；Phase 3 UI 放入租户签约/结算分区 |
| 聚合根 version 冲突提示 | `shared/http.ts` 已从 `x-expected-revision`、query/body `expectedRevision`、body `sourceRevision` 解析到 request context，所有写路由透传 mutation | 后端已具备；前端仍需冲突弹窗 | Phase 2 UI |
| 写操作后入 projection outbox，UI toast 可跳转 | upsertEntity 会 enqueue outbox | 前端 toast/跳转未按 v3 全面实现 | Phase 2 通用投影反馈 |
| 本轮只做主数据，不做交易/履约执行 | 旧计划含开店/打烊、桌台运行态等表述 | 容易把后台做成运行工作台 | 后端禁止写入桌台运行态；经营状态只保留为配置/主数据事实，不实现订单或履约动作 |

## 3. API 缺口矩阵

| 实体/场景 | 列表 | 详情 | 创建 | 修改 | 业务动作 | 投影 | 缺口 |
|-----------|------|------|------|------|----------|------|------|
| Sandbox | 已有 | 可由列表项承载 | 已有但计划 Phase 1 不显示 | 已有状态动作 | activate/suspend/close | 无 topic | UI 应隐藏新建/停用，避免误导 |
| Platform | 已有 | 可由列表项承载 | 已有 | generic update + ISV | activate/suspend | 有 | 需要前端详情页和 ISV 只展示/续期边界 |
| Project | 已有 | 可由列表项承载 | 已有 | generic update | activate/suspend | 有 | 表单仍需按项目向导补全 |
| Tenant | 已有 | 可由列表项承载 | 已有 | generic update | suspend cascade | 有 | UI 需呈现签约/结算主体，不单独主导航 BusinessEntity |
| Brand | 已有 | 可由列表项承载 | 已有 | generic update | activate/deactivate | 有 | UI 和表单必须避免 tenant 归属 |
| Contract | 已有 | 可由列表项承载 | 已有 | amend/renew | activate/terminate | 有 | create 应为 PENDING；activate 有 ACTIVE 合同时应失败；terminate 应为 TERMINATED 并置门店菜单 INVALID；EXPIRED 查询派生 |
| Store | 已有 | 可由列表项承载 | 已有 | generic update | 主数据启停/经营配置 | 有 | 只维护物理铺位、合同快照和经营配置；不做开店/接单/打烊执行流 |
| Table | store-scoped 已有 | 可由列表项承载 | 已有 | generic status | 主数据启用/停用 | 有 | 桌台只维护项目/门店/区域/容量/包房/预订支持/消费说明等配置；禁止占用、预订、开台运行态 |
| Workstation | store-scoped 已有 | 可由列表项承载 | 已有 | generic status | 主数据启用/停用 | 有 | 工作站维护门店、类型、可处理品类、打印/屏幕/产能配置；不做工单执行 |
| Permission | 已有 | 可由列表项承载 | 已有 | generic update | activate/suspend 可复用 | 有 | 需要风险等级/角色使用数派生或前端计算 |
| Role | 已有 | 可由列表项承载 | 已有 | generic update + `PUT /api/v1/roles/:roleId/permissions` | activate/suspend | 有 | 后端已支持 N 对 N 权限更新；UI 必须做成多选授权器 |
| User | 已有 | 可由列表项承载 | 已有 | generic update | activate/suspend | 有 | 授权范围不应只等于 storeId；grant modal 要支持全平台/项目/门店 |
| RoleBinding | 已有 | 可由列表项承载 | 已有 | revoke | grant/revoke | 有 | 后端已支持 `resourceScope/scopeSelector`，覆盖平台/项目/门店/标签/组合范围；UI 需用业务语言表达 |
| Product | 已有 | 可由列表项承载 | 已有 | generic update | activate/suspend/sold-out/restore | 有 | 下架商品应影响菜单提示；表单字段要覆盖 variants/modifiers |
| BrandMenu | 已有 | 可由列表项承载 | 已有 | generic update | review APIs | 有 | mock 应按 APPROVED/INACTIVE 简化；缺发布/停用语义和影响门店确认 |
| StoreMenu | 已有 | 可由列表项承载 | 已有 | generic update | rollback | 有 | 合同终止时要置 INVALID；详情要展示 sections/products |
| StoreConfig | store-scoped 已有 | 可由列表项承载 | upsert | upsert | 经营参数维护 | 有 | 后端已覆盖营业状态、接单策略参数、营业时段、特殊日期、渠道时段、附加费、退款库存策略；本轮只作为主数据配置 |
| SaleableStock | store-scoped 已有 | 可由列表项承载 | upsert | upsert | 设置可售库存汇总 | 有 | 后端已支持 total/sold/reserved/available/safety/threshold/reset/ingredient；`reserved_quantity` 是汇总事实，不实现 StockReservation 生命周期 |
| MenuAvailability | store-scoped 已有 | 可由列表项承载 | upsert | upsert | set available/unavailable | 有 | 已有 `PUT /api/v1/stores/:storeId/menu-availability/:productId`，并保留商品 sold-out/restore 快捷动作 |
| PriceRule | store-scoped 已有 | 可由列表项承载 | 已有 | `PATCH /api/v1/price-rules/:ruleId` | disable | 有 | 后端已覆盖 rule_name、time slot、星期、会员等级、priority、discount/price；新增冲突校验按商品集合、渠道、会员、优先级、日期、星期和时段判断 |
| ProjectionOutbox | 已有 diagnostics | 已有 payload | 系统生成 | retry | publish/retry | n/a | payload 应默认收起；列表要按 v3 字段展示 |
| PublishLog | 已有表 | 可从 diagnostics 补 | 系统生成 | 不可改 | 不可改 | n/a | 缺正式列表 API 或 web 入口 |

## 4. Phase 1 优先修复顺序

1. mutation context：已把 `expectedRevision` 从 body/header/query 传入所有写 API；前端仍需冲突弹窗。
2. 合同状态机：已实现 PENDING -> ACTIVE -> TERMINATED，查询派生 EXPIRED；已有 ACTIVE 合同则激活失败；合同签署快照不随项目分期/业主后续变化而变化。
3. 项目与合同模型：已支持项目分期和分期业主；合同保存甲方项目/分期/业主快照与乙方门店/租户/品牌/签约主体快照。
4. 合同终止联动：已清空 store 快照，门店菜单置 INVALID。
5. 主数据运行边界：桌台、工作站、StoreConfig 只维护配置和启停，不引入开台/接单/履约工单执行动作。
6. IAM N 对 N：已补 role permission update；role binding 已支持全平台/项目/门店/标签/组合授权范围。
7. Product/Menu/Operation：已补商品、菜单、价格规则、可售规则、库存基础字段，不实现交易扣减工作流；继续检查菜单版本/覆盖不可变语义。
8. Projection：已有 publish log list；所有写动作返回 outbox/source event，可供前端 toast 使用。

## 5. Phase 0 完成定义核对

| 完成定义 | 状态 |
|----------|------|
| API 缺口矩阵可以逐项驱动后端实现 | 已完成，本文件第 3 节 |
| `/customer` 重建范围明确，不再把详情常驻面板、页面重复 metrics、技术字段主显作为可接受方案 | 已完成，本文件第 1 节与计划第 2 节 |

Phase 0 可以进入 Phase 1；但 Phase 1 尚未完成。

## 6. Phase 1 第一次后端对照结论

> 对照来源：`design-v3/1.业务分析与领域设计/01-组织层级与多租户模型.md`、`02-用户与角色域.md`、`05-商品与门店经营域.md`。  
> 本次边界：只做主数据底座，不实现订单、支付、履约工单、桌台会话、预订生命周期、库存预占生命周期等交易/履约执行流程。

| 领域 | design-v3 主张 | 当前后端状态 | 结论/下一步 |
|------|----------------|--------------|-------------|
| 双键隔离 | 所有业务实体必须由 `sandbox_id + platform_id` 隔离 | 已补 product/menu/price/availability/stock 等派生 `platform_id`，并新增非默认 Platform 回归测试验证 business event 与 projection outbox 均携带正确 `platform_id` | 第一轮通过，第二轮需再以数据查询/列表 API 验证过滤语义 |
| Platform 业务字典 | 项目业态、大区、品牌品类、门店经营场景、桌台类型、工作站品类等由集团维护 | `metadata_catalog` 已统一承载并修复为“保留已有项 + 合并缺失默认项” | 后续 UI 必须把这些字段做成字典选择，不允许手写 |
| Project | Project 直属 Platform，维护大区、业态、分期与分期业主 | `project_phases` 已存在并在合同创建时快照 lessor project/phase/owner | 继续保留已确认模型，不回退 |
| Tenant/Brand | Tenant 是法人/商户；Brand 直属 Platform，二者通过 Contract 在 Store 上关联 | Tenant 禁止 `tenant_category`；Brand repair 删除 `tenant_id`；合同写 Store 快照 | 后续 UI 不能再显示“品牌所属租户” |
| Store/Contract | Store 当前租户/品牌/经营主体只能由生效合同驱动；合同是签署快照 | 合同创建保存甲乙方快照；生效写 Store 快照；终止清空快照并使门店菜单 INVALID；项目业主变化不影响已签合同 | 已有契约测试覆盖，第二轮需再看合同状态与时间窗细节 |
| Table | design-v3 原文包含桌台占用/预订运行态，但本轮只做主数据 | 后端只允许 AVAILABLE/DISABLED，禁止写入 `current_session_id`、`current_booking_id`、`occupied_at` 等运行态；保留区域、类型、容量、二维码、可预订配置、消费者说明、最低消费 | 符合本轮边界；不实现开台/预订/清洁流 |
| Workstation | 工作站是门店生产/交付主数据，不能承载履约队列运行态 | 后端保留类型、可处理品类、描述，并禁止工单、队列、进行中数量等运行态字段 | 仍需在后续 UI 强化项目/门店/类型/品类表达 |
| StoreOperatingConfig | 门店营业配置是交易前置配置，包含营业状态、接单策略、营业时段、附加费 | 后端已有 `operating_status`、`auto_accept_enabled`、`max_concurrent_orders`、`operating_hours`、`special_operating_days`、`extra_charge_rules` 等；不实现接单动作 | 符合“主数据支撑交易，不做交易”的边界 |
| Product/Menu | 商品、品牌菜单、门店菜单要支持品牌库/门店库、规格、加料、套餐、生产画像、菜单版本 | 后端已覆盖 product variants/modifiers/combo/production_profile、brand_menu、menu_catalog、继承关系、发布/回滚基础；跨平台商品引用已拒绝 | 第二轮需再检查菜单覆盖字段、品牌强制商品、版本不可改语义是否足够 |
| Price/Availability/Stock | 价格、可售规则、可售库存是独立聚合；库存预占属于交易事件闭环 | 后端已覆盖 price_rule、bundle_price_rule、availability_rule、menu_availability、saleable_stock；`reserved_quantity` 只作为可售计算事实，不实现 StockReservation 生命周期 | 符合边界；禁止把库存预占流程做进后台 |
| IAM | User/Role/Permission/UserRoleBinding/PrincipalGroup/GroupRoleBinding 等支撑三元授权与审计 | 后端已有用户、角色、权限、用户绑定、资源标签、用户组、组成员、组授权、授权会话、SoD、高风险策略骨架与鉴权审计 | 仍需后续二次核对 ScopeSelector 的完整表达和 UI 的 N 对 N 授权操作 |

第一轮结论：当前后端主干没有发现“必须立即回退”的越界实现；主要风险从“模型是否存在”转为“接口细节是否完整、自洽、可被前端完整表达”。下一步仍在 Phase 1：跑后端类型/构建/契约测试后，做第二轮 design-v3 对照，重点检查 IAM ScopeSelector、菜单版本/覆盖、合同状态边界和可售库存边界。

## 7. Phase 1 第二次后端对照结论

> 对照来源：`design-v3/1.业务分析与领域设计/02-用户与角色域.md` 第 4.5、4.6、4.11 与鉴权流程第 4 步；同时复核本轮“只做主数据，不做交易/履约执行”的范围声明。

| 核对项 | design-v3 要求 | 本轮后端状态 | 结论 |
|--------|----------------|--------------|------|
| UserRoleBinding 三元关系 | 用户 + 角色 + `resource_scope` 是独立聚合，允许同一用户在不同资源范围拥有不同角色 | `/api/v1/user-role-bindings` 已同时兼容旧 `scopeType/scopeId/storeId` 和新 `resourceScope/scopeSelector`；保存 `platform_id`、`resource_scope`、`scope_selector`、有效期、ALLOW/DENY、策略条件 | 已对齐，前端必须用业务语言表达范围，不显示 `scope_type` 技术词 |
| ScopeSelector 四模式 | 支持 `TAG`、`ORG_NODE`、`RESOURCE_IDS`、`COMPOSITE` | 后端新增统一归一化与比较：TAG 按标签集合、ORG_NODE 按组织节点类型和 ID 集合、RESOURCE_IDS 按资源类型和 ID 集合、COMPOSITE 按子选择器 AND 语义；重复授权比较使用归一化后的完整结构，不再只比 `scope_key` | 已对齐 |
| Store 鉴权目标展开 | 鉴权时 ScopeSelector 必须能判断目标资源是否落入范围 | `bindingMatchesStore` 现在由门店反推项目、平台、租户、品牌、大区，并支持门店标签匹配；项目/平台/门店旧范围仍保留兼容 | 已覆盖后台主数据最重要查询场景：集团/项目/门店/标签范围 |
| GroupRoleBinding | 用户组授权与用户直接授权使用同一 ScopeSelector 结构 | `/api/v1/iam/group-role-bindings` 已接收 `resourceScope/scopeSelector`；组成员有效权限计算会合并组绑定与直接绑定 | 已对齐 |
| DENY 优先与审计 | 命中 ALLOW 和 DENY 时 DENY 优先，并记录鉴权审计 | 既有 `policy_effect=DENY`、`checkPermissionDecision`、`auth_audit_logs` 保持通过；新增 ScopeSelector 后仍由契约测试覆盖 | 已对齐 |
| 主数据边界 | IAM 是主数据权限底座；不得引入交易/履约动作 | 本轮只补授权范围和鉴权匹配，没有新增订单、支付、履约、开台、预订或库存预占生命周期 | 未越界 |

本轮新增后端契约证据：

- 直接用户授权：`STORE` 兼容写法、`ORG_NODE(project)`、`TAG`、`RESOURCE_IDS(store)`、`COMPOSITE(project AND tag)` 均可命中门店鉴权。
- 重复授权：同一用户、同一角色、同一组合范围，即使子选择器顺序不同，也会被拒绝。
- 用户组授权：旧 `PROJECT` 写法和新 `ORG_NODE(project)` 写法均可让组成员获得门店有效权限。
- 撤销直接门店授权后，其它有效范围授权仍保留，证明绑定是独立聚合，不会因为一个范围撤销而误删其它范围。

验证命令（2026-04-26）：

```bash
corepack yarn workspace @next/mock-admin-mall-tenant-console-server type-check
corepack yarn workspace @next/mock-admin-mall-tenant-console-server build
node --import tsx scripts/mock-admin-console-contract.test.mjs
```

结果：三项均通过；契约测试 `10/10` 通过。

第二轮结论：IAM ScopeSelector 后端已经从“只能表达平台/项目/门店的简化范围”补齐到 design-v3 要求的可组合授权范围。Phase 1 仍未整体完成，下一步继续按主数据边界检查商品/菜单、合同状态、可售库存、投影下发与终端模型对齐，确认无遗漏后再进入前端重建。

## 8. Phase 1 第三次后端对照结论

> 对照来源：`design-v3/1.业务分析与领域设计/05-商品与门店经营域.md` 的 Product / BrandMenu / Menu / PriceRule / AvailabilityRule / StoreOperatingConfig / SaleableStock。  
> 本次边界：这些实体是交易与履约的基础配置，不实现交易下单、支付、履约工单、库存预占生命周期。

| 核对项 | design-v3 要求 | 本轮后端状态 | 结论 |
|--------|----------------|--------------|------|
| Product | 商品聚合覆盖规格、加料、套餐、生产画像、图片、过敏原、营养、标签 | 后端已覆盖 variants、modifier_groups、combo_items/combo_item_groups、combo_pricing_strategy、combo_stock_policy、combo_availability_policy、production_profile/production_steps、图片和描述字段；非法价格、规格默认、套餐子商品数量/引用均有校验 | 已对齐主数据表达 |
| BrandMenu / StoreMenu | 菜单用分区和菜单商品表达 N 对 N 关系，支持关系属性、继承与覆盖 | 后端已保存 sections/products、standard/override price/name/image、mandatory、featured、daily_quota、availability_rules、inherit_mode、override_scope；门店菜单生效时会替换同门店旧 ACTIVE 菜单 | 仍需继续复核已发布菜单的不可直接修改/新版本语义 |
| PriceRule | 价格规则独立聚合，按渠道、时段、会员等级、优先级和有效期裁决 | 后端已覆盖 rule_name、applicable_product_ids、channel_type、time_slot、days_of_week、member_tier、priority、discount/price、effective_from/to；冲突校验已精确到商品集合、渠道、会员、优先级、日期、星期和时段 | 已补强并由契约测试覆盖 |
| AvailabilityRule | 可售规则独立聚合，MANUAL 同商品同渠道同时间只能一条，TIME_SLOT/QUOTA 需校验结构 | 后端已校验日期范围、时段格式、星期范围、限量数量；MANUAL 重复判断已纳入生效时间窗，允许不重叠时间窗并存 | 已补强并由契约测试覆盖 |
| StoreOperatingConfig | 门店营业配置是经营前置配置，不做接单执行 | 后端保存 operating_status、auto_accept/accept_order、超时、备餐缓冲、并发上限、周营业时段、特殊日期、渠道时段、附加费、退款库存策略；校验营业时段不重叠 | 符合主数据边界 |
| SaleableStock | 可售库存维护汇总事实，预占生命周期由交易事件闭环处理 | 后端保存 total/sold/reserved/available/remaining/safety/threshold/reset/ingredient；校验库存不能小于 sold+reserved，阈值不能超过总库存 | 符合主数据边界；`reserved_quantity` 仅作事实汇总 |

新增后端契约证据（2026-04-26）：

- 价格规则：相同门店/商品/渠道/会员/优先级/时段但星期重叠会拒绝；星期不重叠可并存；非法星期拒绝。
- 可售规则：非法日期范围拒绝；非法时段拒绝；当前人工规则与未来人工规则因时间窗不重叠可并存。
- 库存：`reserved_quantity` 可作为汇总事实参与 available 计算；库存小于 sold+reserved 会拒绝。

验证命令（2026-04-26）：

```bash
corepack yarn workspace @next/mock-admin-mall-tenant-console-server type-check
corepack yarn workspace @next/mock-admin-mall-tenant-console-server build
node --import tsx scripts/mock-admin-console-contract.test.mjs
```

结果：三项均通过；契约测试 `10/10` 通过。

第三轮结论：商品/菜单/经营配置主数据后端已经覆盖 design-v3 的关键业务字段和主要不变式，且未越界实现交易/履约生命周期。Phase 1 仍需继续复核：已发布菜单不可直接修改/新版本语义、合同时间段重叠与到期派生边界、投影 payload/发布日志能否支撑前端 toast 和终端对齐。

## 9. Phase 1 第四次后端对照结论

> 对照来源：`ai-result/2026-04-25-admin-console-ux-design-v3.md` 的菜单旅途、合同快照旅途、投影反馈要求，以及 `design-v3/1.业务分析与领域设计/01-组织层级与多租户模型.md`、`05-商品与门店经营域.md`。  
> 本次边界：主数据后台必须能维护签署快照、菜单版本、商品/可售/价格/经营配置和投影事实；不实现订单、支付、履约工单、桌台开台/结账、预订生命周期、库存预占生命周期。

| 核对项 | design-v3 / v3 UX 要求 | 本轮后端状态 | 结论 |
|--------|-------------------------|--------------|------|
| 契约测试隔离 | 回归测试不能污染或依赖开发库，否则会把开发库脏数据当成业务事实 | `scripts/mock-admin-console-contract.test.mjs` 改为设置 `MOCK_ADMIN_MALL_TENANT_CONSOLE_DB_FILE` 后再动态 import server/database/service，确保测试真正使用临时 SQLite | 已修复测试基础设施；后续证据可信 |
| BrandMenu 审批唯一性 | 同一品牌、渠道、菜单类型和生效窗口内只能有一份已批准/生效菜单；审批自身不能被误判为冲突 | `assertActiveBrandMenuWindowUnique` 现在按实体 ID、`brand_menu_id`、`menu_id` 排除自身，并同时看行状态与 `review_status`；创建冲突菜单会返回 `ACTIVE_BRAND_MENU_CONFLICT` | 已对齐 |
| 已审批/已发布菜单不可原地改 | 菜单是下发和终端消费的版本化快照，已审批品牌菜单与已激活/回滚门店菜单不能直接改结构 | 契约测试覆盖已审批 BrandMenu patch `sections` 返回 `MENU_VERSION_IMMUTABLE`、已回滚 StoreMenu patch `menu_name` 返回 `MENU_VERSION_IMMUTABLE`，新版本通过 `parentMenuId`、`version`、`createdFromVersion`、`changeSummary` 创建 | 已对齐；前端必须做“创建新版本”入口，不做原地编辑误导 |
| StoreMenu 继承与覆盖 | 门店菜单继承品牌菜单时必须保留品牌必选商品，覆盖范围由品牌菜单定义 | 后端要求继承的 BrandMenu 必须 APPROVED/ACTIVE；缺失 mandatory 商品返回 `STORE_MENU_MANDATORY_PRODUCT_MISSING`；`allow_store_override=false` 或 `override_scope` 禁止字段会返回相应错误 | 已对齐 |
| BusinessEntity / 签约结算主体 | 后端可保留签约/结算主体兼容结构，但不能泄漏明文银行账号；主体信息要满足合同快照基础 | 已校验统一社会信用代码在集团内唯一、税率 0..1、结算日 1..31；`bank_account_no` 不进入响应，只保存 `bank_account_no_masked` | 已对齐主数据安全边界；前端文案应是“签约主体/结算主体”，不做技术实体导航 |
| 合同到期派生 | 合同是签署快照；已签合同不随项目分期/业主后续变更而变；到期状态由查询派生 | 新增/保持契约：过期 ACTIVE 合同列表派生为 `EXPIRED`；Store 也派生 `contract_status` / `active_contract_status=EXPIRED`，不修改原签署快照 | 已对齐 |
| 组合优惠与跨平台引用 | 价格/组合优惠是经营主数据，必须只引用同集团门店和商品 | 契约测试改为使用同集团下创建的两个商品，不再依赖 seed 商品；跨平台商品引用仍返回 `BUNDLE_TRIGGER_PRODUCT_PLATFORM_MISMATCH` | 已对齐；这是主数据约束，不是交易优惠计算 |
| 主数据边界 | 只做交易/履约基础，不做运行流程 | 本轮只加强菜单审批、版本、组合优惠引用、主体安全和到期派生；未新增订单、支付、履约工单、预订、开台/结账、库存预占生命周期 | 未越界 |

新增/修复后端契约证据（2026-04-26）：

- 契约测试真实隔离 SQLite，不再读取 `server/data/mock-admin-mall-tenant-console.sqlite` 旧开发数据。
- BrandMenu 审批通过时不与自身冲突；重叠窗口的第二份已审批 BrandMenu 仍被拒绝。
- StoreMenu 缺失品牌必选商品、越权覆盖商品价格/图片/可售规则均被拒绝。
- BusinessEntity 不返回银行账号明文，并校验统一社会信用代码、税率、结算日。
- 已过期 ACTIVE 合同与 Store 只读派生为 `EXPIRED`，不破坏合同签署快照。

验证命令（2026-04-26）：

```bash
corepack yarn workspace @next/mock-admin-mall-tenant-console-server type-check
corepack yarn workspace @next/mock-admin-mall-tenant-console-server build
node --import tsx scripts/mock-admin-console-contract.test.mjs
```

结果：三项均通过；契约测试 `10/10` 通过。

第四轮结论：后端主数据不变式比第三轮更稳，尤其是测试隔离、菜单版本化和合同/主体边界。Phase 1 仍需继续复核投影 payload / publish log / 终端模型字段对齐；在这项完成前，不应宣布后端总体完成，也不应把前端当作最终完成证据。

## 10. Phase 1 第五次后端/终端投影对照结论

> 对照来源：v3 UX 第 22-24 节投影监控、发布日志、通用交互规范，以及本轮用户明确边界“只做主数据，不涉及交易和履约，但必须作为交易/履约基础”。  
> 本次核对目标：后台写模型产生的主数据 topic 能被终端主数据 kernel 包识别、存储、选择；投影列表不会因数据量撑破页面。

| 核对项 | 要求 | 本轮状态 | 结论 |
|--------|------|----------|------|
| Projection Outbox 分页 | 投影队列是高增长数据，列表必须分页，不能一次性撑破页面 | `/api/v1/diagnostics/projections/outbox` 改为 `okPage`，支持 `page/size/status`；前端 API 改为 `requestPage` 并保持 `/customer` 状态读取 `.data` | 已补齐 |
| Publish Log 分页 | 发布日志同样是高增长数据，必须分页 | `/api/v1/diagnostics/projections/publish-log` 改为 `okPage`，支持 `page/size`；前端 API 改为分页读取 | 已补齐 |
| Product 终端 topic | 后台投影 `product_category`、`product_inheritance`、`channel_product_mapping`，终端必须认识 | `catering-product-master-data` 已包含 `catering.product-category.profile`、`catering.product-inheritance.profile`、`catering.channel-product-mapping.profile` 和对应 selector | 已对齐 |
| Store Operating 终端 topic | 后台只投影经营配置、可售规则、可售库存汇总，不投影库存预占生命周期 | `catering-store-operating-master-data` 已移除 `catering.stock-reservation.active`，以 `reserved_quantity` 汇总事实表达库存占用影响 | 符合边界 |
| Organization/IAM 终端 topic | 后台已投影地区、经营主体、桌台、工作站、IAM 目录、用户组、组授权、风险策略等，终端不能丢 topic | `organization-iam-master-data` 已补齐 `org.region.profile`、`iam.identity-provider.catalog`、`iam.permission-group.catalog`、`iam.role-template.catalog`、`iam.feature-point.catalog`、`iam.platform-feature-switch.catalog`、`iam.resource-tag.catalog`、`iam.principal-group.catalog`、`iam.group-member.catalog`、`iam.group-role-binding.store-effective`、`iam.authorization-session.active`、`iam.sod-rule.catalog`、`iam.high-risk-policy.catalog` | 已对齐主数据承接能力 |
| 终端业务视角 selector | 终端工作台不能只是原始 topic 堆叠，要能看到组织、商品、经营、IAM 的业务摘要 | 三个 kernel 包已有 summary/display selectors；本轮 IAM summary 增加权限组、角色模板、功能点、用户组、组授权、风险策略统计；组织树按 Platform/Region/Project/Tenant/Brand/Store/Table/Workstation 业务关系展示 | 初步对齐，后续 UI 仍需优化 |
| 主数据边界 | 不实现交易、履约、预订、开台、库存预占生命周期 | 本轮只补 topic/type/selector 和分页；没有新增运行态命令或交易动作 | 未越界 |

验证命令（2026-04-26）：

```bash
corepack yarn workspace @next/mock-admin-mall-tenant-console-server type-check
corepack yarn workspace @next/mock-admin-mall-tenant-console-server build
node --import tsx scripts/mock-admin-console-contract.test.mjs
corepack yarn workspace @next/mock-admin-mall-tenant-console-web type-check
corepack yarn workspace @next/mock-admin-mall-tenant-console-web build
corepack yarn workspace @next/kernel-business-organization-iam-master-data type-check
corepack yarn workspace @next/kernel-business-organization-iam-master-data test --no-file-parallelism --maxWorkers=1
corepack yarn workspace @next/kernel-business-catering-product-master-data type-check
corepack yarn workspace @next/kernel-business-catering-product-master-data test --no-file-parallelism --maxWorkers=1
corepack yarn workspace @next/kernel-business-catering-store-operating-master-data type-check
corepack yarn workspace @next/kernel-business-catering-store-operating-master-data test --no-file-parallelism --maxWorkers=1
```

结果：以上验证均通过；server 契约测试 `10/10` 通过，三个终端主数据包各 `1/1` 通过，web 构建通过。

第五轮结论：后端主数据与终端主数据 kernel 的 topic 承接已基本对齐，投影高增长列表也已服务端分页。仍不能声明总目标完成：前端 `/customer` 仍需逐实体按后端字段和用户旅途重做表单/详情/列表/搜索，并需要浏览器模拟 CRUD；安卓虚拟机端还需做编辑 -> 下发 -> 终端投射链路验证。
