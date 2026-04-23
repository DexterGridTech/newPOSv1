# Mock Admin Mall Tenant Master Data Design

## Background

This design defines the first production-shaped business master-data slice for
the new POS runtime. The goal is not to build a simplified test fixture. The
mock server must behave like a replaceable business backend so that later
switching from mock services to real services does not require changing terminal
topic semantics, kernel package boundaries, or UI read models.

The slice covers:

1. Mall/Tenant administration for organization, tenant, brand, store, contract,
   catering product, catering store operation, and store-level IAM master data.
2. TDP projection publishing through the existing `mock-terminal-platform`.
3. Three new `1-kernel/1.2-business` master-data packages.
4. One new `2-ui/2.2-business` terminal master-data viewing package.
5. `retail-shell` routing after terminal activation.

This slice intentionally does not implement employee login. Some terminal
classes, such as KDS and KIOSK, are activation-only devices and must be usable
without employee login. Store IAM master data is still distributed now because
future POS login, logout, forced logout, and user-information-change flows will
depend on the same data distribution model.

## Source Alignment

The design follows these source documents:

1. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/01-组织层级与多租户模型.md`
2. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/02-用户与角色域.md`
3. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/04-终端体系域设计（TDP+TCP）.md`
4. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/05-商品与门店经营域.md`
5. `/Users/dexter/Documents/workspace/idea/requirement-doc/design-v3/1.业务分析与领域设计/13-设计红线与数据一致性保障.md`
6. `/Users/dexter/Documents/workspace/idea/newPOSv1/spec/layered-runtime-communication-standard.md`
7. `/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-dev-methodology.md`
8. `/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-ui-runtime-dev-methodology.md`

The most important constraints are:

1. TDP is passive distribution infrastructure. Business domains publish
   projections to TDP; TDP does not pull business data.
2. TCP does not store business data. TCP remains responsible for terminal
   activation, credentials, control, and task delivery only.
3. Region is not part of TDP OrgScope. In this slice, Region is modeled as a
   `Project` value-object attribute, not as an independent terminal scope.
4. Business payloads must align with design-v3 domain models. Mock data must
   not rename, flatten, or drop business fields just because the current
   implementation is a mock.
5. Kernel packages are React-free and consume TDP topics through commands,
   selectors, and typed state.
6. Cross-package writes use public commands. UI reads through selectors and
   dispatches commands; it does not mutate business slices directly.

## Goals

1. Create `0-mock-server/mock-admin-mall-tenant-console` as an independent
   `server + web` mock backend using the same technology style as
   `mock-terminal-platform`.
2. Maintain production-shaped organization, IAM, catering product, and catering
   store operation master data.
3. Publish business projections into `mock-terminal-platform` TDP with
   production-shaped topic and scope semantics.
4. Create three typed business master-data packages under
   `1-kernel/1.2-business`.
5. Create one professional terminal catering master-data workbench under
   `2-ui/2.2-business/catering-master-data-workbench`.
6. Route both primary and secondary displays to the catering master-data
   workbench after terminal activation, while preserving topology-aware titles
   and identical content structure across single-machine dual-screen and
   two-machine single-screen deployments.
7. Preserve future login/logout/session design paths without implementing login
   in this phase.

## Non-Goals

1. Do not implement employee login UI or login runtime in this phase.
2. Do not implement trading, fulfillment, settlement, channel, booking, or
   governance flows.
3. Do not add authorization to the mock admin console itself.
4. Do not make TDP topic or scope semantics simpler than production just for
   testing convenience.
5. Do not merge organization, IAM, catering product, and catering operation
   payloads into one large test topic.
6. Do not make `mock-admin-mall-tenant-console` replace TCP/TDP. It integrates
   with `mock-terminal-platform`, which remains the TCP/TDP backend.

## Package Names And Dependencies

The three `1-kernel/1.2-business` packages are:

| Directory | Published package | Module name | Responsibility |
| --- | --- | --- | --- |
| `organization-iam-master-data` | `@impos2/kernel-business-organization-iam-master-data` | `kernel.business.organization-iam-master-data` | Organization and store-level IAM master data |
| `catering-product-master-data` | `@impos2/kernel-business-catering-product-master-data` | `kernel.business.catering-product-master-data` | Catering product, menu, price, modifier, combo, and production-profile master data |
| `catering-store-operating-master-data` | `@impos2/kernel-business-catering-store-operating-master-data` | `kernel.business.catering-store-operating-master-data` | Catering store operation, availability, stock, sold-out, and operating-config master data |

Dependency rules:

1. `organization-iam-master-data` does not depend on either catering package.
2. `catering-product-master-data` may depend on
   `organization-iam-master-data`.
3. `catering-store-operating-master-data` may depend on
   `organization-iam-master-data`.
4. The two catering packages must not depend on each other.

Rationale:

1. Organization and user master data are shared foundations and should not be
   separated in this phase.
2. Catering product data must be explicitly separate from future retail or
   other vertical product master data.
3. Store operation data changes for different reasons than product/menu data,
   but both are anchored to store/brand/tenant organization facts.

Clarification about the three-package split:

1. Package A is `organization-iam-master-data`.
2. Package B is `catering-product-master-data`.
3. Package C is `catering-store-operating-master-data`.
4. Future employee login/session does not consume one of the three package
   slots, because it belongs to terminal runtime/session state rather than
   business master data.
5. Future login/session is reserved through dedicated HTTP boundaries and TDP
   topics so this phase can keep the three business packages focused on
   master-data truth.

## Business Data Model

### Organization And IAM

`organization-iam-master-data` aligns with design-v3 organization and IAM
models. It owns typed terminal read models for:

1. `Platform`
2. `Project`
3. `Tenant`
4. `Brand`
5. `Store`
6. `Contract`
7. `User`
8. `Permission`
9. `Role`
10. `UserRoleBinding`

Region handling:

1. Region is not an independent entity in this implementation.
2. Region is a `Project` attribute.
3. The `Project` region value should be structured enough for future evolution:

```ts
export interface ProjectRegionValue {
    regionCode: string
    regionName: string
    parentRegionCode?: string | null
    regionLevel?: number | null
}
```

The terminal package must expose selectors for:

1. Current platform by activated terminal binding.
2. Current project by activated terminal binding.
3. Current tenant by activated terminal binding.
4. Current brand by activated terminal binding.
5. Current store by activated terminal binding.
6. Current active contract for the store.
7. Store-effective users.
8. Store-effective roles.
9. Store-effective permissions.
10. Store-effective user-role bindings.
11. A derived organization tree for terminal UI display.
12. A derived IAM readiness summary for future login.

### Catering Product Master Data

`catering-product-master-data` aligns with design-v3 catering product models. It
owns typed terminal read models for:

1. `Product`
2. `ProductVariant`
3. `ProductionProfile`
4. `ModifierGroup`
5. `ComboPricingStrategy`
6. `ComboItemGroup`
7. `ComboItem`
8. `ComboStockPolicy`
9. `ComboAvailabilityPolicy`
10. `BrandMenu`
11. `BrandMenuSection`
12. `BrandMenuProduct`
13. `Menu`
14. `MenuSection`
15. `MenuProduct`
16. `PriceRule`
17. `BundlePriceRule`

The package must not rename catering-domain fields into generic retail terms.
For example, `Product.production_steps`, `ModifierGroup.selection_type`, and
`PriceRule.channel_type` remain aligned with the design-v3 field semantics even
if TypeScript converts snake_case wire fields into camelCase internal fields.

Projection strictness for this package:

1. The TDP wire payload must preserve design-v3 field names, nested structures,
   and enum literals.
2. Fields such as `ownership_scope`, `base_price`, `product_type`,
   `production_steps`, `modifier_groups`, `combo_item_groups`, `price_type`,
   and `channel_type` must remain business-faithful in the published payload.
3. Internal TypeScript normalization is allowed only after explicit decoding and
   test-covered mapping.

The package must expose selectors for:

1. Effective menus for the current store.
2. Menu sections sorted by design order.
3. Products by menu and category.
4. Product details including variants, modifiers, combo definitions, and
   production profiles.
5. Price rules by product and channel.
6. A resolved display model for terminal workbench rendering.

### Catering Store Operating Master Data

`catering-store-operating-master-data` aligns with design-v3 store operation and
availability models. It owns typed terminal read models for:

1. `AvailabilityRule`
2. `StoreOperatingConfig`
3. `ExtraChargeRule`
4. `OperatingHours`
5. `SpecialOperatingDay`
6. `SaleableStock`
7. `StockReservation`

The package must expose selectors for:

1. Current store operating status.
2. Current day operating hours.
3. Store extra charge rules.
4. Product availability rules by product.
5. Saleable stock by product/SKU.
6. Sold-out and low-stock summaries.
7. Special operating day overrides.
8. A resolved operation dashboard model for the terminal workbench.

## TDP Topic Contract

All topics in this slice are production-shaped retained-state topics unless
explicitly marked otherwise. Scope ownership follows business ownership; test
convenience must not change where data belongs.

### Organization Topics

| Topic | Payload mode | Scope | Item key | Owner package | Meaning |
| --- | --- | --- | --- | --- | --- |
| `org.platform.profile` | `retained_state` | `PLATFORM` | `platform_id` | `organization-iam-master-data` | Platform profile |
| `org.project.profile` | `retained_state` | `PROJECT` | `project_id` | `organization-iam-master-data` | Project profile, including Region value |
| `org.tenant.profile` | `retained_state` | `TENANT` | `tenant_id` | `organization-iam-master-data` | Tenant profile |
| `org.brand.profile` | `retained_state` | `BRAND` | `brand_id` | `organization-iam-master-data` | Brand profile |
| `org.store.profile` | `retained_state` | `STORE` | `store_id` | `organization-iam-master-data` | Store profile |
| `org.contract.active` | `retained_state` | `STORE` | `contract_id` | `organization-iam-master-data` | Active contract for a store |

These topics must not be collapsed into a single `org.context` topic. Each
business object lands at its natural scope.

### IAM Topics

| Topic | Payload mode | Scope | Item key | Owner package | Meaning |
| --- | --- | --- | --- | --- | --- |
| `iam.permission.catalog` | `retained_state` | `PLATFORM` | `permission_id` | `organization-iam-master-data` | Platform/system permission catalog |
| `iam.role.catalog` | `retained_state` | `PLATFORM` | `role_id` | `organization-iam-master-data` | Platform/system role catalog |
| `iam.user.store-effective` | `retained_state` | `STORE` | `user_id` | `organization-iam-master-data` | Users effective for the store |
| `iam.user-role-binding.store-effective` | `retained_state` | `STORE` | `binding_id` | `organization-iam-master-data` | Role bindings effective for the store |

Notes:

1. Permission and role catalogs are platform-scoped because they are not native
   store records.
2. Users and role bindings are store-effective projections. A terminal should
   receive only users and bindings relevant to its store.
3. These topics are required even though employee login is not implemented in
   this phase.

### Catering Product Topics

| Topic | Payload mode | Scope | Item key | Owner package | Meaning |
| --- | --- | --- | --- | --- | --- |
| `catering.product.profile` | `retained_state` | Natural `BRAND` or `STORE` scope derived from `Product.ownership_scope` | `product_id` | `catering-product-master-data` | Product aggregate with variants, modifiers, combo data, and production profile |
| `catering.brand-menu.profile` | `retained_state` | `BRAND` | `brand_menu_id` | `catering-product-master-data` | Brand menu aggregate |
| `menu.catalog` | `retained_state` | `STORE` | `menu_id` | `catering-product-master-data` | Store-effective menu aggregate |
| `catering.price-rule.profile` | `retained_state` | `STORE` | `rule_id` | `catering-product-master-data` | Store product price rule |
| `catering.bundle-price-rule.profile` | `retained_state` | `STORE` | `rule_id` | `catering-product-master-data` | Store bundle price rule |

`menu.catalog` remains because design-v3 already identifies it as the terminal
menu directory topic. The more explicit `catering.*` topics carry production
source objects that the package can also use to build richer workbench views.

Scope rules:

1. Brand-owned products publish `catering.product.profile` at `BRAND` scope.
2. Store-owned products publish `catering.product.profile` at `STORE` scope.
3. Scope is determined by the source aggregate's `ownership_scope`, not by test
   convenience and not by terminal subscription shape.
4. `menu.catalog` remains `STORE` scoped in this slice because the terminal-side
   effective menu is always store-resolved; brand-level source menus are carried
   separately by `catering.brand-menu.profile`.
5. A product projection must never be duplicated into both `BRAND` and `STORE`
   scopes for the same source aggregate revision.

### Catering Store Operation Topics

| Topic | Payload mode | Scope | Item key | Owner package | Meaning |
| --- | --- | --- | --- | --- | --- |
| `store.config` | `retained_state` | `STORE` | `config_id` | `catering-store-operating-master-data` | Store operating config |
| `menu.availability` | `retained_state` | `STORE` | `product_id` | `catering-store-operating-master-data` | Effective store/product availability view |
| `catering.availability-rule.profile` | `retained_state` | `STORE` | `rule_id` | `catering-store-operating-master-data` | Availability rule source projection |
| `catering.saleable-stock.profile` | `retained_state` | `STORE` | `stock_id` | `catering-store-operating-master-data` | Saleable stock source projection |
| `catering.stock-reservation.active` | `retained_state` | `STORE` | `reservation_id` | `catering-store-operating-master-data` | Active stock reservations for observability |

`menu.availability` remains because it is the canonical terminal-facing
availability topic in design-v3. Source-rule topics are separate so the terminal
workbench can inspect why an item is available, sold out, low stock, or blocked.

`menu.availability` is a resolved effective view keyed by `product_id`; raw
rule-source inspection stays on `catering.availability-rule.profile`.

### Future Terminal User Session Topics

These topics are reserved now but not implemented in the first phase:

| Topic | Payload mode | Scope | Item key | Meaning |
| --- | --- | --- | --- | --- |
| `terminal.user.session` | `retained_state` | `TERMINAL` | `terminal_id` | Current employee session for a terminal |
| `terminal.user.session.event` | `durable_event` | `TERMINAL` | `event_id` | Login, logout, forced logout, and session-change events |

Future login/logout must not be modeled inside
`organization-iam-master-data`. Organization/IAM master data answers "who may
work here and with which permissions"; terminal user session answers "who is
currently operating this terminal".

## Projection Payload Contract

Every projection payload uses a common envelope while preserving strict business
object shape inside `data`.

```ts
export interface BusinessMasterDataProjectionEnvelope<TData> {
    schema_version: number
    projection_kind:
        | 'organization'
        | 'iam'
        | 'catering_product'
        | 'catering_store_operation'
        | 'terminal_user_session'
    sandbox_id: string
    platform_id: string
    source_service: string
    source_event_id: string
    source_revision: number
    generated_at: string
    data: TData
}
```

Rules:

1. Envelope fields are for projection routing and observability.
2. `data` contains the production-shaped business object or read model.
3. `data` field names, enum values, and nested object structure must align with
   design-v3 exactly. The TDP wire payload is not simplified for the mock.
4. Business payloads published into TDP must use design-v3 wire names as the
   external contract. If internal TypeScript state uses camelCase, conversion
   happens only after explicit decode and must be covered by tests.
5. Scope-defining fields inside `data` must agree with the TDP scope. For
   example, a `Product` with `ownership_scope = BRAND` must not be published at
   `STORE` scope, and a store-effective IAM payload must not be published above
   `STORE` scope.
6. `source_event_id` is mandatory for idempotency.
7. `source_revision` is a monotonic revision within the source object stream.
8. Delete projections use TDP `operation = 'delete'`; they do not encode a
   fake deleted payload unless the business object needs a retained tombstone.
9. Consumers must accept `schema_version` values from `1` through the current
   supported maximum and reject newer versions with a typed validation error
   instead of silently corrupting state.

### Terminal Scope Resolution

This design relies on the existing production-shaped terminal scope chain:

```text
PLATFORM -> PROJECT -> BRAND -> TENANT -> STORE -> GROUP -> TERMINAL
```

After activation, the terminal receives projections from every matching scope in
that chain. `PLATFORM`, `PROJECT`, `BRAND`, `TENANT`, and `STORE` topics are
therefore all valid for an activated store terminal. Business packages consume
the resolved topic stream emitted by `tdp-sync-runtime-v2`, whose selector keeps
the highest-priority matching projection per `topic + itemKey` according to the
scope chain.

Implications:

1. `iam.permission.catalog` and `iam.role.catalog` reach the terminal through
   the `PLATFORM` segment of the scope chain.
2. Brand-owned `catering.product.profile` records reach the terminal through the
   `BRAND` segment, while store-owned records reach it through the `STORE`
   segment.
3. Store terminals do not receive another store's `STORE` scoped products
   because `STORE` scope only matches the activated store ID.
4. If the same `topic + itemKey` exists at multiple matching scopes, the lower
   scope in the chain wins. This is an override mechanism, not a duplication
   mechanism.
5. If a business package needs diagnostic metadata, `tdpTopicDataChanged` must
   expose `scopeType`, `scopeId`, `sourceReleaseId`, and `occurredAt` for each
   change item, not only `itemKey`, `payload`, and `revision`.

## Mock Admin Mall Tenant Console

### Package Shape

Directory:

`0-mock-server/mock-admin-mall-tenant-console`

Workspace package:

`@impos2/mock-admin-mall-tenant-console`

Technology:

1. Server: Node.js, Express, TypeScript, Drizzle, SQLite.
2. Web: React, TypeScript, Vite.
3. API style: same response envelope conventions as `mock-terminal-platform`.
4. Persistence: independent SQLite database, not shared tables with
   `mock-terminal-platform`.
5. Top-level package scripts should mirror `mock-terminal-platform`: `dev`,
   `build`, `type-check`, and `clean`, delegating to local `server` and `web`
   workspaces.

### Runtime Relationship With mock-terminal-platform

`mock-admin-mall-tenant-console` is the business backend. It does not manage
terminal activation, sessions, or WebSocket delivery.

`mock-terminal-platform` remains the terminal platform backend. It owns:

1. Sandbox runtime selection.
2. TCP terminal activation.
3. Terminal credentials.
4. TDP sessions.
5. TDP projections.
6. TDP change logs.
7. TDP WebSocket delivery.

Integration path:

```text
mock-admin-mall-tenant-console write model
  -> local outbox
  -> projection adapter
  -> projection publisher
  -> mock-terminal-platform TDP batch-upsert API
  -> terminal TDP session
```

`mock-terminal-platform` already exposes
`POST /api/v1/admin/tdp/projections/batch-upsert`. This design requires that API
to support production-shaped publisher semantics:

1. The publisher sends `source_event_id` as the TDP `sourceReleaseId` equivalent
   or as a dedicated field if the platform API is extended.
2. Re-sending the same `source_event_id` for the same
   `topic + scopeType + scopeKey + itemKey` is idempotent and returns the
   already accepted result.
3. Re-sending an older `source_revision` after a newer revision was accepted
   must not overwrite the retained projection.
4. Duplicate delivery to terminal clients is acceptable only if the retained
   projection stays monotonic and business packages ignore stale revisions.
5. In the mock environment the publisher uses a static server-to-server token
   such as `MOCK_TERMINAL_PLATFORM_ADMIN_TOKEN`; if auth is disabled locally, the
   token is still present in configuration so the boundary remains compatible
   with a protected environment.

### Server Modules

| Module | Responsibility |
| --- | --- |
| `organization-service` | Platform, Project, Tenant, Brand, Store, Contract write model |
| `iam-service` | User, Permission, Role, UserRoleBinding write model |
| `catering-product-service` | Product, BrandMenu, Menu, PriceRule, BundlePriceRule write model |
| `catering-store-operating-service` | StoreOperatingConfig, AvailabilityRule, SaleableStock, StockReservation write model |
| `projection-adapter` | Converts write-model changes into TDP projection envelopes |
| `projection-outbox` | Durable local queue of projection publish requests |
| `projection-publisher` | Calls `mock-terminal-platform` TDP projection APIs |
| `terminal-auth-service` | Reserved business HTTP boundary for future terminal login/logout/session APIs; it will publish session projections through `mock-terminal-platform` TDP instead of owning TDP sessions |

### Outbox Design

All write-model changes that should reach terminals create outbox records before
publishing to TDP.

Minimum outbox fields:

```ts
export interface ProjectionOutboxRecord {
    outbox_id: string
    sandbox_id: string
    source_service: string
    source_event_id: string
    topic_key: string
    scope_type: string
    scope_key: string
    item_key: string
    operation: 'upsert' | 'delete'
    payload_json: string
    status: 'PENDING' | 'PUBLISHED' | 'FAILED'
    attempt_count: number
    last_error?: string | null
    created_at: number
    updated_at: number
    published_at?: number | null
}
```

Publishing is batch-oriented. A UI action can save many objects and produce many
outbox records at their natural scopes.

Publisher state transitions:

1. `PENDING` records are picked up in creation order and published in batches.
2. A successful batch response marks each accepted item `PUBLISHED`.
3. A retriable transport or 5xx failure increments `attempt_count`, records
   `last_error`, and leaves the item retryable.
4. A validation failure marks the item `FAILED` and surfaces it on the web
   console with a manual retry/republish action.
5. Manual retry never creates a second logical event; it republishes the same
   `source_event_id` unless the operator intentionally creates a new business
   change.

### HTTP APIs

The admin console itself has no permission gate in this phase.

Representative API groups:

1. `/api/v1/organization/platforms`
2. `/api/v1/organization/projects`
3. `/api/v1/organization/tenants`
4. `/api/v1/organization/brands`
5. `/api/v1/organization/stores`
6. `/api/v1/organization/contracts`
7. `/api/v1/iam/users`
8. `/api/v1/iam/permissions`
9. `/api/v1/iam/roles`
10. `/api/v1/iam/user-role-bindings`
11. `/api/v1/catering/products`
12. `/api/v1/catering/brand-menus`
13. `/api/v1/catering/store-menus`
14. `/api/v1/catering/price-rules`
15. `/api/v1/catering/store-operating-configs`
16. `/api/v1/catering/availability-rules`
17. `/api/v1/catering/saleable-stocks`
18. `/api/v1/projections/outbox`
19. `/api/v1/projections/publish`

Future terminal auth API reservation:

1. `POST /api/v1/terminal-auth/login`
2. `POST /api/v1/terminal-auth/logout`
3. `GET /api/v1/terminal-auth/session/:terminalId`
4. `POST /api/v1/terminal-auth/force-logout`
5. `POST /api/v1/terminal-auth/refresh-store-user-projections`

The first implementation may return `501 Not Implemented` for terminal auth
endpoints, but the route ownership should be reserved.

### Web Console Information Architecture

The mock admin web app should feel like a business operations console, not a
raw fixture editor.

Primary navigation:

1. Overview
2. Organization
3. IAM
4. Catering Product
5. Catering Store Operation
6. Projection Outbox
7. TDP Delivery Diagnostics

Important UI behaviors:

1. Any business save action shows which projections will be emitted.
2. Operators can manually republish projections for a selected object or store.
3. Projection diagnostics show topic, scope, itemKey, source revision, outbox
   status, TDP publish response, and terminal delivery status where available.
4. Store-centric pages show the activated terminal list from
   `mock-terminal-platform` so users can verify which terminals should receive
   the data.
5. Failed outbox items support manual retry and manual republish from the web
   console.

## Kernel Business Package Behavior

All three business packages use the same ingestion pattern:

1. Listen to `tdpSyncV2CommandDefinitions.tdpTopicDataChanged`.
2. Ignore topics outside the package topic allowlist.
3. Validate projection envelope `schema_version` against the package supported
   version range.
4. Validate `projection_kind`.
5. Convert business payload into typed internal state.
6. Apply upsert/delete to the package slice.
7. Emit a package-owned public changed command.
8. Expose selectors for UI and integration packages.

Topic roles inside the packages:

1. `menu.catalog` is the authoritative terminal-effective menu view.
2. `catering.brand-menu.profile`, `catering.product.profile`,
   `catering.price-rule.profile`, and `catering.bundle-price-rule.profile` are
   source-object projections for traceability, richer inspection, and selector
   joins. They must not override a published `menu.catalog` effective view.
3. `menu.availability` is the authoritative terminal-effective availability
   view.
4. `catering.availability-rule.profile`,
   `catering.saleable-stock.profile`, and `catering.stock-reservation.active`
   explain why the effective availability view has its current status.
5. `iam.user.store-effective` and
   `iam.user-role-binding.store-effective` are store-filtered projections.
   `iam.permission.catalog` and `iam.role.catalog` are platform catalogs joined
   by role/permission IDs.
6. `catering.stock-reservation.active` contains only active reservations.
   Confirmed, released, or expired reservations are removed with TDP delete
   operations; the mock console may simulate lifecycle changes for integration
   testing.

Changed commands:

| Package | Command |
| --- | --- |
| `organization-iam-master-data` | `organizationIamMasterDataChanged` |
| `catering-product-master-data` | `cateringProductMasterDataChanged` |
| `catering-store-operating-master-data` | `cateringStoreOperatingMasterDataChanged` |

Reset/rebuild commands:

| Package | Commands |
| --- | --- |
| `organization-iam-master-data` | `resetOrganizationIamMasterData`, `rebuildOrganizationIamMasterDataFromTdp` |
| `catering-product-master-data` | `resetCateringProductMasterData`, `rebuildCateringProductMasterDataFromTdp` |
| `catering-store-operating-master-data` | `resetCateringStoreOperatingMasterData`, `rebuildCateringStoreOperatingMasterDataFromTdp` |

Reset/rebuild semantics:

1. `reset*` clears the package's typed state and diagnostics. It does not ask
   TDP to resubscribe and does not clear the generic TDP raw repository.
2. `rebuild*FromTdp` replays the current raw/resolved TDP projection repository
   through the package decoder to reconstruct typed state after restart,
   schema-code upgrade, or manual recovery.
3. `rebuild*FromTdp` must be deterministic and must not emit outbound writes.
4. `rebuild*FromTdp` may emit the package changed command once after rebuilding
   if derived selectors changed.
5. If the current `tdp-sync-runtime-v2` selectors do not expose enough resolved
   metadata for rebuild diagnostics, implementation must extend that base
   package first instead of duplicating TDP resolution in business packages.

State persistence:

1. Typed master-data states should be persisted.
2. TDP raw projection state remains the generic sync repository.
3. UI and business logic read typed business state, not raw TDP JSON.
4. Runtime-only observation fields, such as last processed command request ID,
   should not be persisted unless they are needed for restart recovery.

## UI Business Package

Directory:

`2-ui/2.2-business/catering-master-data-workbench`

Published package:

`@impos2/ui-business-catering-master-data-workbench`

Module name:

`ui.business.catering-master-data-workbench`

Purpose:

Render the terminal's local typed business master-data read model after
activation. This is not an admin editor. It is a professional terminal-side
data inspection workbench that proves what the terminal has received and how the
business packages interpreted it.

### Screen Structure

The screen uses five stable regions:

1. Top status bar.
2. Left domain navigation.
3. Center work area.
4. Right detail inspector.
5. Bottom projection health strip.

The center work area uses a "summary ribbon + primary data pane + contextual
subpane" composition instead of a single flat admin table. This keeps dense
business data visible without making the page chaotic.

Top status bar:

1. Terminal ID.
2. Store ID and store name.
3. TDP session status.
4. Last cursor.
5. Last topic update time.
6. Data freshness indicator.

Left domain navigation:

1. Organization & IAM.
2. Catering Product.
3. Catering Store Operation.

Each item displays object counts and warning badges.

Cross-view interaction model:

1. Global search by object ID, business name, topic, and scope key.
2. Faceted filters for status, warning state, and recently changed objects.
3. Live highlight for objects changed by the latest processed projection.
4. Selection is stable across live updates so the operator can inspect a record
   while new projections continue to arrive.

Selection stability rules:

1. Selection is keyed by durable business identity, never by list index.
2. If the selected object is updated, the inspector stays open and refreshes in
   place.
3. If the selected object is deleted, the UI shows a tombstone/removed state and
   keeps the last known diagnostic metadata until the operator changes
   selection.
4. The workbench does not require selector-level frozen snapshots; stability is
   achieved by ID-based selection state plus explicit removed-state handling.

Center work area:

1. Organization & IAM view:
   - Summary ribbon: scope chain, active contract, user count, role count,
     permission count, and readiness warnings.
   - Hierarchy band: Platform -> Project(region) -> Tenant -> Brand -> Store -> Contract.
   - Store-effective IAM matrix: users, roles, permissions, and bindings.
   - Role coverage panel: which permissions are actually granted inside this
     store-effective scope.
   - Future login readiness summary without login UI.
2. Catering Product view:
   - Summary ribbon: menu count, product count, combo count, price-rule count,
     and schema warning count.
   - Left subpane: category tree and menu section rail.
   - Primary pane: product grid/list with clear price, status, and availability
     badges.
   - Detail tabs: variants, modifiers, combo structure, price rules, and
     production profile.
   - Effective-menu lens: show the store-resolved menu representation beside the
     underlying source aggregate references.
3. Catering Store Operation view:
   - Summary ribbon: operating status, low-stock count, sold-out count,
     reservation count, and special-day status.
   - Operating status summary.
   - Operating hours calendar.
   - Availability rules.
   - Saleable stock and reservation table.
   - Extra charge rules.
   - Special operating days.
   - Rule-to-stock correlation panel so operators can tell whether a product is
     blocked by schedule, manual off-shelf, quota, or stock.

Right detail inspector:

1. Full typed object fields.
2. Source topic.
3. Scope type and scope key.
4. Item key.
5. Revision.
6. Updated time.
7. Raw wire payload.
8. Schema validation result.
9. Derived selector highlights so operators can compare raw projection,
   normalized state, and workbench display result.

Bottom projection health strip:

1. Recent topic changes.
2. Last changed package.
3. Changed command emitted.
4. Projection processing errors.
5. Delivery vs decode vs selector-stage failure marker.

### Design Principles

1. Default view is business-readable, not JSON-first.
2. Every object can open raw payload inspection.
3. Dense data uses tabs, grouped cards, split panes, and summary badges instead
   of one giant table.
4. The page must make it obvious whether a problem is delivery, parsing,
   validation, or UI rendering.
5. No login UI appears in this phase.
6. Live updates should animate or highlight locally changed records without
   stealing focus from the current inspection context.

## Retail Shell Integration

Activation routing changes both display success targets.

| Display | Before activation | After activation |
| --- | --- | --- |
| Primary | Existing activation screen | Catering master-data workbench (`PRIMARY`) |
| Secondary | Existing secondary activation screen | Catering master-data workbench (`SECONDARY`) |

`retail-shell` remains the orchestration owner:

1. Activation success is observed through TCP runtime commands/state.
2. `retail-shell` dispatches `ui-runtime-v2.replaceScreen`.
3. The master-data workbench screen is registered by the
   `ui-business-catering-master-data-workbench` package.
4. The workbench does not own activation orchestration.

## End-To-End Data Flow

```text
Admin edits product in mock-admin-mall-tenant-console
  -> catering-product-service saves Product/Menu/PriceRule
  -> projection-adapter creates production-shaped outbox records
  -> projection-publisher calls mock-terminal-platform batch-upsert
  -> mock-terminal-platform writes TDP projection and change logs
  -> online terminal receives PROJECTION_CHANGED or PROJECTION_BATCH
  -> tdp-sync-runtime-v2 updates raw projection repository
  -> tdp-sync-runtime-v2 emits tdpTopicDataChanged
  -> catering-product-master-data updates typed state
  -> cateringProductMasterDataChanged command is emitted
  -> master-data workbench selectors see new typed state
  -> primary and secondary displays update immediately
```

This flow does not depend on employee login.

## Verification Plan

### Design-Level Acceptance

1. Package names include `catering` where the business model is catering-specific.
2. Organization and IAM master data are in one package.
3. Topic scope follows business ownership and does not collapse data into a
   test-only store context.
4. Region is a Project attribute, not a TDP scope.
5. Future terminal auth APIs and topics are reserved but not part of the primary
   activation flow.
6. UI workbench can display all typed data through structured professional views
   and raw inspectors.

### Implementation Verification

1. Mock console server tests:
   - Creating/updating/deleting each business object writes correct outbox
     records.
   - Projection envelopes keep design-v3 field semantics.
   - Region remains a Project attribute.
2. Projection publisher tests:
   - Outbox records publish to the existing mock TDP batch-upsert API.
   - Replaying the same `source_event_id` is idempotent.
   - Older `source_revision` values cannot overwrite newer retained
     projections.
   - Natural scope and itemKey are preserved.
   - Publish retry records failures without losing outbox data.
3. Kernel package tests:
   - `tdpTopicDataChanged` for each topic updates typed state.
   - Matching `PLATFORM`, `BRAND`, and `STORE` scoped projections arrive through
     the terminal scope chain and resolve consistently.
   - Delete changes remove or tombstone typed state correctly.
   - Changed commands are emitted.
   - Cross-package dependencies follow the allowed graph.
4. UI tests:
   - Each domain view renders dense data without raw JSON as the default.
   - Inspector shows raw projection metadata on selection.
   - Selection stays stable across live updates and shows a removed state when a
     selected object is deleted.
   - Login controls are absent.
5. Retail-shell tests:
   - Before activation, primary remains activation screen.
   - After activation, both primary and secondary switch to catering
     master-data workbench.
   - Primary and secondary titles are topology-aware while layout/content stay
     aligned.
6. Live integration:
   - Start `mock-terminal-platform`.
   - Start `mock-admin-mall-tenant-console`.
   - Activate terminal.
   - Confirm primary workbench loads.
   - Edit organization, IAM, product, and store operation records.
   - Confirm terminal page updates through TDP without refresh or login.

## Open Implementation Notes

1. Root `package.json` workspaces must include `0-mock-server/mock-admin-mall-tenant-console`, `1-kernel/1.2-business/*`, and `2-ui/2.2-business/*`.
2. The existing `mock-terminal-platform` already exposes
   `/api/v1/admin/tdp/projections/batch-upsert`, but implementation must verify
   and, if needed, extend it for `source_event_id` idempotency,
   `source_revision` monotonic protection, and publisher authentication.
3. If the current TDP topic registry requires explicit topic creation, mock
   console startup should seed the topic catalog with all topics in this design.
4. If terminal TDP subscription filtering is tightened later, POS/KDS/KIOSK
   terminal profiles must subscribe only to the topics they need.
5. Future login should be implemented as a separate terminal user session
   runtime package, not as a side effect inside organization/IAM master data.
6. `tdp-sync-runtime-v2` change events may need metadata extension so business
   packages and the workbench can show scope/source diagnostics without reading
   raw TDP state directly.
7. Typical seed data should include enough volume for realistic UI and TDP batch
   behavior: at least 1 platform, 1 project, 2 tenants, 2 brands, 3 stores,
   50-100 catering products, 2-4 menus, 10-20 users, 3-5 roles, price rules,
   availability rules, saleable stock, and active/resolved stock reservations.
