# Mock Admin Mall Tenant Console UC-Aligned Backoffice Design

## 1. Design Goal

This design upgrades `mock-admin-mall-tenant-console` from a projection editor
into a production-shaped local replacement for the real admin backoffice of the
master-data slice. The target is not "good enough for demo". The target is:

1. Management behavior is 99% aligned with
   `design-v3/2.系统需求用例/UC-01-组织与租户管理-v2`,
   `UC-02-用户与权限管理-v2`, and
   `UC-03-商品与门店经营-v2`.
2. Data shape is aligned with the corresponding domain design documents and is
   safe to switch later to a real backend environment without changing terminal
   contracts.
3. Terminal-side kernel packages and UI workbench consume production-shaped TDP
   projections instead of mock-specific shortcuts.

This document supersedes the earlier "master-data design" as the authoritative
spec for the admin console product shape.

## 2. Source Of Truth

This design is derived from:

1. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/2.系统需求用例/UC-01-组织与租户管理-v2/INDEX.md`
2. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/2.系统需求用例/UC-02-用户与权限管理-v2/INDEX.md`
3. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/2.系统需求用例/UC-03-商品与门店经营-v2/INDEX.md`
4. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/01-组织层级与多租户模型.md`
5. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/02-用户与角色域.md`
6. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/04-终端体系域设计（TDP+TCP）.md`
7. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/05-商品与门店经营域.md`
8. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/13-设计红线与数据一致性保障.md`

## 3. Scope

### 3.1 In Scope

The console fully models the master-data management surface for:

1. System initialization and sandbox/platform administration relevant to this
   local environment.
2. Organization, tenant, brand, project, store, contract, table, workstation,
   and business-entity administration.
3. Store-facing IAM administration needed for future employee login:
   local users, roles, role bindings, permission inspection, and permission
   testing.
4. Catering product, category, variant, modifier, combo, production profile,
   brand menu, store menu, pricing, availability, operating config, sold-out,
   and saleable stock management.
5. Projection outbox, publish, replay, drift inspection, and terminal delivery
   diagnostics.
6. Terminal master-data workbench on both primary and secondary screens.

### 3.2 Out Of Scope

The following are explicitly not implemented as business modules in this round:

1. Trade, payment, settlement, channel order intake, booking, fulfillment, and
   post-transaction flows.
2. Real employee login UI on terminal.
3. External IdP runtime integration, MFA runtime, approval engine runtime, and
   enterprise directory sync runtime.

### 3.3 Reserved But Productized

The console must still reserve real boundaries for:

1. Terminal login, logout, user-info-change, and forced logout HTTP APIs.
2. Future TDP push of `terminal.user.session` and related events.
3. Full `ScopeSelector` domain model, even if this round only opens store-level
   ORG_NODE authorization operations in the main UI.

## 4. Core Product Principles

1. Workflow-first, payload-second.
   The primary operator journey is through domain pages and stateful workflow
   operations, not direct JSON mutation.
2. Design-v3 field fidelity.
   Stored data and published payloads use the same business names, enums,
   nesting, and state semantics as the design documents.
3. Natural scope ownership.
   Data is published to TDP at the scope owned by the source fact. Test
   convenience must not change `scopeType`.
4. Realistic causal chain.
   Terminal changes must result from realistic business operations such as
   contract activation, menu publication, sold-out, or role binding updates.
5. Expert observability built in.
   Every business page can expose raw aggregate, revision, outbox, TDP
   projection, and terminal observation for debugging, but those are secondary
   tools.

## 5. System Boundary

`mock-admin-mall-tenant-console` remains:

1. An independent server plus web backoffice.
2. The business master-data authority in the local mock environment.
3. A producer of TDP projections through `mock-terminal-platform`.

`mock-terminal-platform` remains:

1. The TCP/TDP platform runtime.
2. The activation and terminal session authority.
3. The retained projection store and terminal delivery path.

The integration chain is:

```text
admin workflow -> business write model -> audit/event log -> projection outbox
-> mock-terminal-platform batch-upsert -> TDP retained state -> terminal sync
-> kernel business packages -> catering master-data workbench
```

## 6. Product Information Architecture

The console information architecture must replicate the mental model of the real
backoffice, not the current document list.

### 6.1 Top Navigation

1. `初始化与环境`
2. `组织与租户`
3. `门店设施`
4. `用户与权限`
5. `餐饮商品`
6. `品牌菜单`
7. `门店经营`
8. `投影与联调`

### 6.2 Global Shell

The shell contains:

1. Current sandbox and platform switcher.
2. Search entry for platform/project/store/user/product/menu.
3. Global revision pulse showing pending outbox count and last publish result.
4. Audit ribbon showing latest business event and affected TDP topics.
5. Right-side inspector drawer for raw aggregate, projection payload, and diff.

## 7. Detailed Module Design

## 7.1 初始化与环境

This module covers `UC-01-000` to `UC-01-006`.

### Pages

1. `系统初始化向导`
2. `沙箱列表`
3. `新建沙箱`
4. `沙箱生命周期操作页`
5. `平台列表`
6. `创建集团平台`
7. `ISV 授权配置`
8. `Token 续期与告警`
9. `平台生命周期操作页`

### Required Behaviors

1. Initialization can run exactly once.
2. Sandbox types are `PRODUCTION`, `DEMO`, `DEBUG`.
3. Sandbox lifecycle follows `ACTIVE -> SUSPENDED -> ARCHIVED`.
4. Platform lifecycle follows `ACTIVE -> INACTIVE`.
5. ISV token data is encrypted at rest and masked in the UI.
6. Token nearing expiry emits business events and creates diagnostics records.

### TDP Impact

Only platform and project/store-level downstream relevant records publish to
terminal TDP. Sandbox operational details and ISV secrets do not publish as
terminal master data.

## 7.2 组织与租户

This module covers `UC-01-007` to `UC-01-017`, `UC-01-020` to `UC-01-026`.

### Pages

1. `组织驾驶舱`
2. `组织树`
3. `Project 列表与详情`
4. `创建购物中心`
5. `Tenant 列表与入驻`
6. `Brand 列表与创建`
7. `Store 列表`
8. `开设门店`
9. `自营门店向导`
10. `Store 生命周期操作页`
11. `经营合同列表`
12. `创建经营合同`
13. `合同切换监控`
14. `法人主体管理`
15. `外部同步诊断`

### Domain Decisions

1. Region remains a management concept in the admin UI.
2. Region is not an independent terminal TDP scope.
3. Terminal-facing `Project` payload contains region as a value object.
4. Contract is the only truth source for current store tenant/brand ownership.
5. Store retains contract snapshot fields for query performance only.

### Required Behaviors

1. Store creation does not directly bind tenant or brand.
2. Contract creation is mandatory for store operation.
3. Contract lifecycle job performs activation, expiration, and seamless switch.
4. Contract switch updates store snapshot and emits downstream business events.
5. Tenant suspension automatically cascades store suspension semantics.
6. Brand lifecycle restricts new contract creation and menu availability.
7. Organization tree filters by management context but uses the same canonical
   entities as the write model.

### Terminal-Relevant Entities

1. `Platform`
2. `Project`
3. `Tenant`
4. `Brand`
5. `Store`
6. `Contract`
7. `BusinessEntity`
8. `Table`
9. `Workstation`

## 7.3 门店设施

This module covers `UC-01-018` and `UC-01-019`.

### Pages

1. `桌台列表`
2. `创建桌台`
3. `桌台批量导入与二维码查看`
4. `工作站列表`
5. `创建工作站`
6. `工作站职责映射`

### Required Behaviors

1. Table state machine follows the organization design.
2. Table identity uses `store_id + table_no` uniqueness.
3. Workstation type and category responsibility are explicit.
4. Workstation payload is available to the terminal workbench because later KDS
   and production flows will consume the same master data.

## 7.4 用户与权限

This module covers the realistic subset of `UC-02` while preserving the full
domain model.

### Fully Productized In This Round

1. `UC-02-001` 创建本地用户
2. `UC-02-002` 用户生命周期管理
3. `UC-02-009` 查看系统角色
4. `UC-02-010` 创建自定义角色
5. `UC-02-012` 角色生命周期管理
6. `UC-02-013` 授予用户角色
7. `UC-02-014` 撤销用户角色
8. `UC-02-023` 配置组织节点范围授权
9. `UC-02-034` 查看用户权限
10. `UC-02-035` 权限测试

### Reserved But Structured In This Round

1. `UC-02-003` 登录与认证
2. `UC-02-004` 密码与账号安全
3. `UC-02-015` 临时授权
4. `UC-02-016` DENY 策略
5. `UC-02-017` to `UC-02-020` 用户组
6. `UC-02-021` to `UC-02-022` 资源标签和 TAG 范围
7. `UC-02-024` to `UC-02-032` SoD, 高风险策略, MFA, 会话态身份,
   功能点与自定义权限
8. `UC-02-033` 审计日志

### UI Shape

1. `用户列表`
2. `创建用户`
3. `用户生命周期操作页`
4. `系统角色目录`
5. `自定义角色工作台`
6. `角色授权向导`
7. `店铺级范围授权页`
8. `用户有效权限页`
9. `权限测试台`
10. `登录协议预留页`

### Authorization Boundary For This Round

1. Main executable authorization flow only opens store-level `ORG_NODE`
   bindings for `STORE_STAFF`.
2. The data model still stores full `ScopeSelector`, `policy_effect`,
   `effective_from`, `effective_to`, and future governance fields.
3. The UI must explicitly show reserved capabilities instead of hiding them, so
   the product shape stays aligned with the real design.

### Terminal-Relevant IAM Projection Principle

1. Permission catalog and role catalog are platform-scoped retained topics.
2. Store terminals receive them through the activated scope chain.
3. Users and bindings are published as store-effective retained topics.
4. Terminal workbench shows both source role definitions and store-effective
   user-binding resolution.

## 7.5 餐饮商品

This module covers `UC-03-001` to `UC-03-006` and `UC-03-018` to `UC-03-019`.

### Pages

1. `商品分类管理`
2. `商品列表`
3. `新建商品`
4. `商品规格配置`
5. `加料组配置`
6. `套餐结构配置`
7. `商品生命周期操作页`
8. `商品生产画像`
9. `品牌商品同步状态`
10. `商品继承关系查看器`

### Required Behaviors

1. Product types `SINGLE`, `COMBO`, and `MODIFIER` are first-class.
2. Product ownership is explicit: `BRAND` or `STORE`.
3. Variants, modifier groups, combo item groups, combo policies, and production
   steps are all managed through dedicated product subpages, not flattened into
   one giant form.
4. Product lifecycle validation must block invalid activation.
5. Brand product updates can propagate to synchronized stores.
6. Store-local override relationships are inspectable.

## 7.6 品牌菜单

This module covers `UC-03-007`, `UC-03-008`, `UC-03-009`, and `UC-03-021`.

### Pages

1. `品牌菜单列表`
2. `品牌菜单编辑器`
3. `品牌菜单审核工作台`
4. `发布到门店向导`
5. `门店菜单列表`
6. `门店菜单本地化编辑器`
7. `菜单版本历史`
8. `版本差异对比`
9. `回滚并重发向导`

### Menu Authority Rules

1. `BrandMenu` is the brand source aggregate.
2. `Menu` is the store-effective aggregate.
3. `menu.catalog` is the terminal authority for effective store menu.
4. `catering.brand-menu.profile` is kept for source traceability and workbench
   diagnostics.
5. If source menu and effective menu disagree temporarily, terminal selectors
   treat `menu.catalog` as the effective truth and expose the source/effective
   drift in diagnostics.

## 7.7 门店经营

This module covers `UC-03-010` to `UC-03-017` and `UC-03-020`.

### Pages

1. `门店营业状态台`
2. `商品沽清与恢复`
3. `营业时段配置`
4. `特殊营业日配置`
5. `接单策略配置`
6. `附加费规则`
7. `渠道差异化定价`
8. `时段差异化定价`
9. `商品可售规则`
10. `库存管理`
11. `库存历史与耗尽记录`

### Required Behaviors

1. Store operating state machine must follow the domain design exactly.
2. Manual sold-out is immediate and does not require menu republish.
3. Availability rules and price rules are independent aggregates with their own
   revision histories.
4. Extra charge rules can stack.
5. Time-slot and channel rules are combined through explicit priority rules.
6. Saleable stock is first-class and can automatically trigger stock-driven
   availability changes.
7. `StockReservation` is not a main admin workflow; it is shown as runtime
   diagnostic state because its real source is upstream order/reservation
   events.

## 7.8 投影与联调

This module replaces the current outbox-only console surface.

### Pages

1. `投影总览`
2. `业务事件时间线`
3. `Projection Outbox`
4. `发布预览`
5. `发布结果与失败重试`
6. `聚合与投影差异查看`
7. `终端订阅观察`
8. `终端主数据快照比对`
9. `重建与重放工具`

### Required Behaviors

1. Business workflows create events and outbox records automatically.
2. Operators can inspect one business action across:
   aggregate change -> event -> outbox -> TDP projection -> terminal receipt.
3. Failed publish is visible, retryable, and auditable.
4. Rebuild means "reconstruct outbox from authoritative retained documents".
5. Reset means "clear terminal package local state only".

## 8. Write Model And Persistence Design

The current `master_data_documents` table is insufficient as the main product
model. The target server must add explicit write-model tables grouped by domain.

### 8.1 Organization Domain Tables

1. `sandboxes`
2. `platforms`
3. `projects`
4. `regions` or embedded `project_region_value`
5. `tenants`
6. `brands`
7. `stores`
8. `contracts`
9. `business_entities`
10. `tables`
11. `workstations`
12. `organization_events`

### 8.2 IAM Domain Tables

1. `users`
2. `permissions`
3. `roles`
4. `user_role_bindings`
5. `auth_audit_logs`
6. `feature_points`
7. `scope_selector_snapshots`
8. `terminal_auth_reserved_events`

### 8.3 Catering Product Domain Tables

1. `product_categories`
2. `products`
3. `product_variants`
4. `modifier_groups`
5. `modifier_group_items`
6. `combo_item_groups`
7. `combo_items`
8. `production_profiles`
9. `brand_menus`
10. `brand_menu_sections`
11. `brand_menu_products`
12. `menus`
13. `menu_sections`
14. `menu_products`
15. `price_rules`
16. `bundle_price_rules`
17. `brand_store_product_sync`
18. `catering_product_events`

### 8.4 Catering Store Operating Domain Tables

1. `store_operating_configs`
2. `operating_hours`
3. `special_operating_days`
4. `extra_charge_rules`
5. `availability_rules`
6. `saleable_stocks`
7. `stock_reservations`
8. `catering_store_operating_events`

### 8.5 Projection And Diagnostics Tables

1. `projection_outbox`
2. `projection_publish_log`
3. `projection_delivery_diagnostics`
4. `terminal_observation_snapshots`

## 9. Event And Outbox Design

Every business mutation emits a business event and at least one outbox row.

### 9.1 Event Requirements

Each event record includes:

1. `event_id`
2. `aggregate_type`
3. `aggregate_id`
4. `event_type`
5. `sandbox_id`
6. `platform_id`
7. `occurred_at`
8. `actor_type`
9. `actor_id`
10. `payload_json`
11. `source_revision`

### 9.2 Outbox Idempotency

`mock-terminal-platform` batch-upsert must be treated as idempotent on:

1. `topic_key`
2. `scope_type`
3. `scope_key`
4. `item_key`
5. `source_event_id`

Publisher guarantees:

1. Re-sending the same event is safe.
2. Older `source_revision` must never overwrite newer retained state.
3. Duplicate deliveries may happen, but stale state must not win.

### 9.3 Publisher Authentication

The publisher uses a configured static server-to-server token such as
`MOCK_TERMINAL_PLATFORM_ADMIN_TOKEN` even in local mock mode, so the boundary is
already production-shaped.

## 10. TDP Topic And Scope Contract

This document keeps the earlier topic design and clarifies the missing runtime
semantics.

### 10.1 Terminal Scope Resolution

After activation, the terminal resolves retained data along the matching scope
chain:

```text
PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> GROUP -> TERMINAL
```

Implications:

1. Platform-scoped role and permission catalogs reach the terminal naturally.
2. Brand-scoped catering products reach the terminal naturally.
3. Store-scoped local overrides only reach the matching store terminal.
4. Multiple scopes on the same `topic + itemKey` are resolved by scope
   priority, not by duplicating records into local state.

### 10.2 Product Scope Clarification

1. `catering.product.profile` is published at `BRAND` scope for brand-owned
   products.
2. `catering.product.profile` is published at `STORE` scope for store-owned
   products.
3. Terminal packages listen to both because they consume the resolved scope
   stream, not a single hardcoded scope bucket.
4. A single source product revision must not be copied to both scopes.

### 10.3 Effective Menu Clarification

1. `menu.catalog` is the authority for terminal effective menu state.
2. `catering.brand-menu.profile` remains source-trace data.
3. `catering.product.profile` remains source aggregate data.
4. The workbench exposes source/effective linkage but does not recompute the
   effective menu from source topics when `menu.catalog` is present.

### 10.4 Reserved Session Topics

The console reserves but does not yet publish:

1. `terminal.user.session`
2. `terminal.user.session.event`

Their HTTP boundary still belongs to `mock-admin-mall-tenant-console`.

## 11. Kernel Package Responsibilities

The three business packages remain:

1. `organization-iam-master-data`
2. `catering-product-master-data`
3. `catering-store-operating-master-data`

### 11.1 organization-iam-master-data

Listens to:

1. `org.platform.profile`
2. `org.project.profile`
3. `org.tenant.profile`
4. `org.brand.profile`
5. `org.store.profile`
6. `org.contract.active`
7. `iam.permission.catalog`
8. `iam.role.catalog`
9. `iam.user.store-effective`
10. `iam.user-role-binding.store-effective`

Emits:

1. typed organization state
2. typed store-effective IAM state
3. `organizationIamMasterDataChanged`

### 11.2 catering-product-master-data

Listens to:

1. `catering.product.profile`
2. `catering.brand-menu.profile`
3. `menu.catalog`
4. `catering.price-rule.profile`
5. `catering.bundle-price-rule.profile`

Treats `menu.catalog` as the effective menu authority.

Emits:

1. typed product and menu state
2. `cateringProductMasterDataChanged`

### 11.3 catering-store-operating-master-data

Listens to:

1. `store.config`
2. `menu.availability`
3. `catering.availability-rule.profile`
4. `catering.saleable-stock.profile`
5. `catering.stock-reservation.active`

Emits:

1. typed operating and availability state
2. `cateringStoreOperatingMasterDataChanged`

### 11.4 Reset And Rebuild Semantics

1. `reset*State` clears only local package state.
2. `rebuild*FromTdp` rebuilds local package state from the already retained TDP
   repository managed by sync runtime.
3. Rebuild does not ask the backend to republish.
4. Republish belongs to admin-console diagnostics tools.

## 12. Terminal Workbench Design

The UI package remains
`2-ui/2.2-business/catering-master-data-workbench`, but its product ambition is
upgraded from a summary page to a realistic terminal master-data explorer.

### 12.1 Screen Rules

1. Primary and secondary both show the workbench after activation success.
2. Secondary keeps the same information structure and visual language as
   primary.
3. Title distinguishes screen role only:
   `餐饮主数据工作台 · PRIMARY`
   `餐饮主数据工作台 · SECONDARY`
4. Single-device dual-screen and dual-device single-screen topologies must
   render the same information architecture.

### 12.2 Workbench Layout

The workbench is a three-column explorer:

1. Left rail: domain tree and entity categories.
2. Center pane: entity list with status, scope, revision, and business badges.
3. Right pane: structured detail tabs.

### 12.3 Detail Tabs

Each entity detail offers:

1. `结构化详情`
2. `关联关系`
3. `状态机`
4. `投影信息`
5. `原始数据`

### 12.4 Domain Sections

1. `组织`
2. `IAM`
3. `商品`
4. `菜单`
5. `经营`
6. `联调诊断`

### 12.5 Realistic Data Presentation Rules

1. Do not flatten away meaningful nested structures.
2. Variants, modifiers, combo groups, price rules, availability rules, and
   production steps all have dedicated structured renderers.
3. Contract detail must show current and next contract when both exist.
4. IAM detail must show role source, scope selector, and effective permission
   derivation.
5. Menu detail must show source brand menu and effective store menu side by
   side.
6. Availability detail must show manual sold-out, rule-based unavailability,
   and stock-driven unavailability separately.

### 12.6 Live Update Stability

1. Selection is always keyed by stable entity identity, never list index.
2. If a selected entity is deleted or falls out of scope, the UI keeps a
   "record no longer available" tombstone until the operator changes selection.
3. List refresh must not collapse the current detail pane during live updates.

## 13. Implementation Decomposition

The overall goal is large, but implementation must still be sliced in a way
that preserves end-to-end realism at each stage.

### Stage 1: Replace Document Editor Foundation

1. Introduce domain write-model tables.
2. Introduce business event tables.
3. Keep current document/projection substrate only as compatibility and
   diagnostics layer.
4. Introduce shell navigation and module placeholders.

### Stage 2: 组织与租户主链路

1. Initialization, sandbox, platform.
2. Project, tenant, brand, store.
3. Contract creation and lifecycle job.
4. Organization tree and store facilities.
5. End-to-end publish to terminal.

### Stage 3: 店铺级 IAM 主链路

1. User create and lifecycle.
2. System roles and custom roles.
3. Store-level role binding using ORG_NODE scope.
4. Effective permission view and permission test.
5. TDP store-effective IAM push and terminal workbench rendering.

### Stage 4: 餐饮商品主链路

1. Categories, products, variants, modifier groups, combo structure.
2. Product lifecycle and production profile.
3. Brand-store product sync.
4. Terminal product explorer rendering.

### Stage 5: 品牌菜单与门店菜单主链路

1. Brand menu editor.
2. Review workflow.
3. Publish to store.
4. Version history, diff, rollback.
5. Terminal effective menu rendering.

### Stage 6: 门店经营主链路

1. Open/close/pause/resume.
2. Operating hours and special days.
3. Sold-out and restore.
4. Price rules, availability rules, extra charge rules.
5. Saleable stock management and diagnostics.

### Stage 7: 投影与联调主链路

1. Event timeline.
2. Outbox traceability.
3. Publish preview, retry, replay.
4. Terminal observation and diff tools.

Each stage must leave the console closer to the real product shape, not add
throwaway demo-only surfaces.

## 14. Acceptance Criteria

The design is complete only if the implemented console can satisfy all of the
following:

1. An operator can perform the core `UC-01`, `UC-02`, and `UC-03` master-data
   workflows through realistic pages, not raw payload editing.
2. The generated data conforms to design-v3 field shape and enum semantics.
3. TDP topics and scopes remain production-shaped.
4. Terminal workbench shows structured, real nested master data on both primary
   and secondary screens.
5. A business mutation can be traced end to end from UI action to terminal
   observation.
6. Replacing mock business backend with a real backend should preserve terminal
   behavior because contracts and payloads are already aligned.

## 15. Open Constraints Accepted By Design

1. We intentionally carry UI and schema for some reserved IAM capabilities
   before runtime support exists.
2. We intentionally keep diagnostic raw views because realistic system work
   needs traceability.
3. We intentionally avoid simplifying Region into a terminal entity, while
   still preserving it as a management construct in the admin console.

