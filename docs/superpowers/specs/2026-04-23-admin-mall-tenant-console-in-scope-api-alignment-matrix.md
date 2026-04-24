# Admin Mall Tenant Console In-Scope API Alignment Matrix

## 1. Purpose

This matrix is the phase-0 contract freeze for the
`admin mall tenant console UC/API aligned master-data` work.

It exists to prevent the mock admin server from continuing to grow around
mock-only routes and payloads. From this point forward, the authoritative
north star is:

1. `docs/superpowers/specs/2026-04-23-admin-mall-tenant-console-uc-aligned-backoffice-design.md`
2. `.omx/plans/2026-04-23-admin-mall-tenant-console-uc-aligned-implementation-plan.md`
3. `design-v3/4.后台服务全面设计`

This matrix is intentionally implementation-oriented:

1. It records the production-shaped route we are aligning to.
2. It records the current mock route or current gap.
3. It records whether the item is `implemented`, `planned`, or `reserved`.
4. It records idempotency, pagination, envelope, and compatibility notes.

## 2. Cross-Cutting Contract Rules

These rules apply to every in-scope API below unless a row explicitly says
otherwise.

### 2.1 Envelope

Target compatibility rule:

1. Follow `13-接口设计规范` response shape semantics:
   `code`, `message`, `data`, `timestamp`, `trace_id`.
2. The current mock shape in both admin servers is still
   `{ success, data } / { success, error }`.
3. During migration, the server may keep the current shape internally for
   existing local consumers, but new production-shaped routes must be designed
   so they can switch to the规范 envelope without DTO breakage.

Current compatibility status:

1. `mock-admin-mall-tenant-console` server: still mock envelope only.
2. `mock-terminal-platform` server: still mock envelope only.
3. This is a phase-2 mandatory infrastructure task, but the route matrix below
   already assumes the real route namespace and DTO shape.

### 2.2 Pagination

List APIs should support:

1. `page`
2. `size`
3. `sort`
4. domain filters from service design

Current compatibility status:

1. `mock-admin-mall-tenant-console` currently has almost no real paginated
   business routes.
2. `mock-terminal-platform` has mixed admin list endpoints, but not aligned to
   the master-data service documents.

### 2.3 Idempotency

Rules:

1. POST create or workflow APIs that create business side effects should accept
   `Idempotency-Key` when the source service design marks them idempotent.
2. State-machine actions that are naturally idempotent may rely on status
   guards and return the current result.
3. TDP publisher APIs must additionally support source-event idempotency.

### 2.4 Error Style

Rules:

1. Keep HTTP status aligned with `13-接口设计规范`.
2. Keep service-specific code style compatible with source docs:
   `organization-service` and `iam-service` examples use string success codes
   like `"0"` / `"SUCCESS"`;
   `product-service` examples mostly use numeric `0`.
3. The mock should not invent a third incompatible business-code style.

### 2.5 Reserved Terminal Auth Boundary

These routes are reserved in-scope boundaries even though business runtime is
not implemented in this round:

1. `POST /api/v1/auth/login`
2. `POST /api/v1/auth/logout`
3. `POST /api/v1/auth/refresh`
4. terminal-facing admin-owned shadow boundary:
   `POST /api/v1/terminal-auth/login`
   `POST /api/v1/terminal-auth/logout`
   `POST /api/v1/terminal-auth/user-info-changed`

Current rule:

1. Service-facing auth routes belong to the IAM-aligned namespace.
2. Terminal auth workflow reservation may still return `501`.
3. Existing `/api/v1/terminal-auth/*` mock routes remain compatibility shims,
   not the long-term IAM replacement.

## 3. Status Vocabulary

Each row uses one of:

1. `implemented`
2. `planned`
3. `reserved`
4. `out-of-scope`

Meaning:

1. `implemented`: code path already exists in the correct namespace or a
   compatibility shim already satisfies the contract closely enough.
2. `planned`: required this round, but current implementation is missing or
   still under old mock namespace.
3. `reserved`: route ownership must exist, but business logic may still return
   `501` this round.
4. `out-of-scope`: deliberately not in this round, even if source service has
   such APIs.

## 4. Organization-Service Matrix

Source baseline:
`design-v3/4.后台服务全面设计/02-organization-service服务设计.md`

All production routes in this section use prefix `/api/v1/org`.

| Domain capability | Real route | Method | Request/Response DTO summary | Pagination | Idempotency | Current mock route / status | This-round status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create sandbox | `/api/v1/org/sandboxes` | `POST` | create sandbox request; returns sandbox summary | No | `Idempotency-Key` | none | `planned` | Current platform has admin sandbox routes under `/api/v1/admin/sandboxes`, but admin mall console does not yet expose org namespace |
| Activate sandbox | `/api/v1/org/sandboxes/{sandboxId}/activate` | `POST` | status transition result | No | natural | none | `planned` | Can be modeled as workflow action |
| Suspend sandbox | `/api/v1/org/sandboxes/{sandboxId}/suspend` | `POST` | status transition result | No | natural | none | `planned` | |
| Close sandbox | `/api/v1/org/sandboxes/{sandboxId}/close` | `POST` | status transition result | No | natural | none | `planned` | |
| List sandboxes | `/api/v1/org/sandboxes` | `GET` | sandbox page result | Yes | n/a | none | `planned` | Supports `status`, `page`, `size` |
| Create platform | `/api/v1/org/platforms` | `POST` | platform create request incl. contact data | No | `Idempotency-Key` | none | `planned` | Existing mock admin console does not yet have real org routes |
| Update ISV credential | `/api/v1/org/platforms/{platformId}/isv-credential` | `PUT` | masked credential write; response should not leak secret | No | idempotent by `PUT` | none | `planned` | Must obey allowlist: token/secret never enter TDP |
| Activate/suspend/close platform | `/api/v1/org/platforms/{platformId}/activate|suspend|close` | `POST` | lifecycle result | No | natural | none | `planned` | |
| Create project | `/api/v1/org/projects` | `POST` | project create request with region value object | No | `Idempotency-Key` | none | `planned` | Region remains admin value object, not terminal entity |
| Activate/suspend/close project | `/api/v1/org/projects/{projectId}/activate|suspend|close` | `POST` | lifecycle result | No | natural | none | `planned` | |
| Create store | `/api/v1/org/stores` | `POST` | store create request without directly binding tenant/brand as source truth | No | `Idempotency-Key` | none | `planned` | Contract remains source of active ownership |
| Activate/suspend/close store | `/api/v1/org/stores/{storeId}/activate|suspend|close` | `POST` | lifecycle result | No | natural | none | `planned` | |
| Create tenant | `/api/v1/org/tenants` | `POST` | tenant create request | No | `Idempotency-Key` | none | `planned` | |
| Activate/suspend/close tenant | `/api/v1/org/tenants/{tenantId}/activate|suspend|close` | `POST` | lifecycle result | No | natural | none | `planned` | suspend/close may cascade store semantics |
| Create brand | `/api/v1/org/brands` | `POST` | brand create request | No | `Idempotency-Key` | none | `planned` | |
| Activate/deactivate brand | `/api/v1/org/brands/{brandId}/activate|deactivate` | `POST` | lifecycle result | No | natural | none | `planned` | |
| Create contract | `/api/v1/org/contracts` | `POST` | contract create request | No | `Idempotency-Key` | none | `planned` | |
| Activate contract | `/api/v1/org/contracts/{contractId}/activate` | `POST` | activation result | No | natural | none | `planned` | Must atomically update store snapshot |
| Renew contract | `/api/v1/org/contracts/{contractId}/renew` | `POST` | renewal request/result | No | `Idempotency-Key` | none | `planned` | |
| Amend contract | `/api/v1/org/contracts/{contractId}/amend` | `POST` | amendment request/result | No | `Idempotency-Key` | none | `planned` | |
| Get org tree | `/api/v1/org/tree` | `GET` | tree query by platform/context/depth | No | n/a | none | `planned` | |
| Query tenant stores | `/api/v1/org/tenants/{tenantId}/stores` | `GET` | filtered store list | Yes | n/a | none | `planned` | |
| Create legal entity | `/api/v1/org/legal-entities` | `POST` | legal entity request/result | No | `Idempotency-Key` | none | `planned` | |
| Table/workstation management | `/api/v1/org/stores/{storeId}/tables`, `/api/v1/org/stores/{storeId}/workstations` | mixed | store facility DTOs | Yes | mixed | none | `planned` | Not explicitly spelled out in current source snippet, but required by UC-aligned design scope |

## 5. IAM-Service Matrix

Source baseline:
`design-v3/4.后台服务全面设计/03-iam-service服务设计.md`

| Domain capability | Real route | Method | Request/Response DTO summary | Pagination | Idempotency | Current mock route / status | This-round status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User login | `/api/v1/auth/login` | `POST` | username/password login result with token payload | No | not via key | `/api/v1/terminal-auth/login` returns `501` | `reserved` | IAM route ownership required; terminal-auth route remains compatibility shim |
| Logout | `/api/v1/auth/logout` | `POST` | logout result | No | natural | `/api/v1/terminal-auth/logout` returns `501` | `reserved` | |
| Refresh token | `/api/v1/auth/refresh` | `POST` | refreshed access token | No | natural | none | `reserved` | |
| MFA verify | `/api/v1/auth/mfa/verify` | `POST` | MFA verification result | No | natural | none | `out-of-scope` | reserved service surface, not required for this round |
| MFA setup | `/api/v1/auth/mfa/setup` | `POST` | MFA seed + QR data | No | natural | none | `out-of-scope` | |
| Create user | `/api/v1/users` | `POST` | user create request; response must not expose password hash | No | `Idempotency-Key` recommended | none | `planned` | |
| Get user detail | `/api/v1/users/{userId}` | `GET` | user detail safe DTO | No | n/a | none | `planned` | |
| Update user | `/api/v1/users/{userId}` | `PUT` | user update DTO | No | idempotent by `PUT` | none | `planned` | |
| Delete user | `/api/v1/users/{userId}` | `DELETE` | soft-delete result | No | yes | none | `planned` | |
| Reset password | `/api/v1/users/{userId}/reset-password` | `POST` | reset-password workflow result | No | `Idempotency-Key` recommended | none | `planned` | Must never echo secret or hash |
| Lock user | `/api/v1/users/{userId}/lock` | `POST` | lock result | No | natural | none | `planned` | |
| List users | `/api/v1/users` | `GET` | paginated users | Yes | n/a | none | `planned` | supports scope filters |
| Create role | `/api/v1/roles` | `POST` | role create DTO | No | `Idempotency-Key` recommended | none | `planned` | |
| List roles | `/api/v1/roles` | `GET` | role list/page | Yes | n/a | none | `planned` | |
| Update role permissions | `/api/v1/roles/{roleId}/permissions` | `PUT` | permission binding DTO/result | No | idempotent by `PUT` | none | `planned` | |
| Grant role binding | `/api/v1/user-role-bindings` | `POST` | binding create DTO/result | No | `Idempotency-Key` recommended | none | `planned` | scope selector must remain explicit |
| Revoke role binding | `/api/v1/user-role-bindings/{bindingId}` | `DELETE` | revoke result | No | yes | none | `planned` | |
| Internal permission check | `/internal/auth/check-permission` | `POST` | internal auth decision | No | n/a | none | `reserved` | Required boundary, but admin console can stub in this round |
| Audit logs | `/api/v1/audit-logs` | `GET` | auth audit page result | Yes | n/a | none | `planned` | |
| IdP config management | `/api/v1/idp-configs*` | mixed | IdP config DTOs | Yes | mixed | none | `out-of-scope` | boundary exists in IAM service, but external IdP runtime is out of scope this round |

## 6. Product-Service Matrix

Source baseline:
`design-v3/4.后台服务全面设计/04-product-service服务设计.md`

| Domain capability | Real route | Method | Request/Response DTO summary | Pagination | Idempotency | Current mock route / status | This-round status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create product | `/api/v1/products` | `POST` | product create DTO with category/spec/addon structure | No | `Idempotency-Key` recommended | none | `planned` | |
| Activate product | `/api/v1/products/{id}/activate` | `POST` | lifecycle result | No | natural | none | `planned` | |
| Suspend product | `/api/v1/products/{id}/suspend` | `POST` | lifecycle result | No | natural | none | `planned` | |
| Delete product | `/api/v1/products/{id}` | `DELETE` | soft-delete result | No | yes | none | `planned` | |
| Sold out product | `/api/v1/products/{id}/sold-out` | `POST` | sold-out request/result with `store_id` and reason | No | `Idempotency-Key` recommended | none | `planned` | |
| Restore product | `/api/v1/products/{id}/restore` | `POST` | restore request/result | No | `Idempotency-Key` recommended | none | `planned` | |
| List products | `/api/v1/products` | `GET` | paginated list filtered by brand/status/category | Yes | n/a | none | `planned` | |
| Create menu | `/api/v1/menus` | `POST` | menu create DTO | No | `Idempotency-Key` recommended | none | `planned` | |
| Submit/approve/reject menu | `/api/v1/menus/{id}/submit-review|approve|reject` | `POST` | menu workflow result | No | natural or key-based | none | `planned` | |
| Publish store menu | `/api/v1/store-menus` | `POST` | store-menu publish request/result | No | `Idempotency-Key` recommended | none | `planned` | |
| Roll back store menu version | `/api/v1/store-menus/{id}/rollback` | `POST` | rollback result | No | `Idempotency-Key` recommended | none | `planned` | |
| Update store config | `/api/v1/stores/{store_id}/config` | `PUT` | store operating config DTO | No | idempotent by `PUT` | none | `planned` | |
| Open/close store | `/api/v1/stores/{store_id}/open|close` | `POST` | store operating lifecycle result | No | natural | none | `planned` | |
| Generate product snapshot | `/api/v1/product-snapshots` | `POST` | immutable snapshot create result | No | `Idempotency-Key` recommended | none | `planned` | Useful for diagnostics even if trade flow is out of scope |
| Get product snapshot | `/api/v1/product-snapshots/{snapshot_id}` | `GET` | snapshot detail | No | n/a | none | `planned` | |
| Update inventory | `/api/v1/stores/{store_id}/inventories/{product_id}` | `PUT` | inventory limit/config DTO | No | idempotent by `PUT` | none | `planned` | |
| Query inventories | `/api/v1/stores/{store_id}/inventories` | `GET` | inventory state list | Yes | n/a | none | `planned` | |
| Category/spec/modifier/combo subresources | `/api/v1/categories`, `/api/v1/products/{id}/variants`, `/api/v1/modifier-groups`, `/api/v1/combos` | mixed | catering domain DTOs | Yes | mixed | none | `planned` | Required by UC-aligned design even if product-service draft does not enumerate every child route yet |

## 7. TDP-Service Matrix

Source baseline:
`design-v3/4.后台服务全面设计/11-tdp-service服务设计.md`

Production shape here is concept alignment rather than literal one-to-one route
reuse, because terminal platform remains a local combined TCP/TDP runtime.

| Domain capability | Real route | Method | Request/Response DTO summary | Pagination | Idempotency | Current mock route / status | This-round status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Publish retained/durable/ephemeral message | `/api/v1/tdp/publish` | `POST` | topic + message type + payload + ttl | No | source-event idempotency for retained projection adapter path | `POST /api/v1/admin/tdp/projections/batch-upsert` | `implemented` | Mock route stays as local admin adapter, but contract must preserve topic, retained state, publish result, delivery diagnostics |
| Query topic subscribers | `/api/v1/tdp/topics/{topic}/subscribers` | `GET` | topic subscriber list | Yes | n/a | no exact equivalent | `planned` | Can be backed by session registry / terminal observation |
| Get terminal retained snapshot | local equivalent | `GET` | terminal-effective retained projections | No | n/a | `GET /api/v1/tdp/terminals/{terminalId}/snapshot` | `implemented` | Must keep metadata-rich envelope |
| Get terminal incremental changes | local equivalent | `GET` | changes since cursor | cursor-based | n/a | `GET /api/v1/tdp/terminals/{terminalId}/changes` | `implemented` | Must keep `scopeType`, `scopeId`, `sourceReleaseId`, `occurredAt`, and later `scopeMetadata` |
| Inspect retained projections | local equivalent | `GET` | admin diagnostics list | Yes | n/a | `GET /api/v1/admin/tdp/projections` | `implemented` | Diagnostics route, not public service route |
| Inspect delivery diagnostics | local equivalent | `GET` | publish/delivery outcome | Yes | n/a | mixed admin routes | `planned` | Should be admin diagnostics namespace only |
| Replay/retry publish | local equivalent | `POST` | replay selected outbox / publish retry | No | source-event aware | admin mall console currently has `/api/v1/projection-outbox/retry|publish` | `planned` | Must move behind production-shaped admin console diagnostics flow |

## 8. Existing Mock-Admin-Mall-Tenant-Console Route Assessment

Current route surface in
`0-mock-server/mock-admin-mall-tenant-console/server/src/modules/master-data/routes.ts`
is still pre-alignment.

| Current route | Assessment | Action |
| --- | --- | --- |
| `/api/v1/master-data/documents` | mock-only raw document editor route | Keep only as diagnostics/backfill during migration; do not use as primary contract |
| `/api/v1/master-data/documents/:docId` | mock-only patch route | Same as above |
| `/api/v1/master-data/demo-change` | demo-only helper | Keep only under explicit debug/demo namespace or remove later |
| `/api/v1/master-data/rebuild-projection-outbox` | useful admin diagnostic/rebuild tool | Keep, but move under diagnostics/projections namespace later |
| `/api/v1/projection-outbox*` | useful infra route, but namespace not yet production-shaped | Keep temporarily; phase-2 should normalize under diagnostics/outbox publisher namespace |
| `/api/v1/terminal-auth/*` | correctly reserved ownership, but wrong long-term service alignment for IAM login/logout | Keep as reserved compatibility shim returning `501` |

## 9. Existing Mock-Terminal-Platform Route Assessment

| Current route | Assessment | Action |
| --- | --- | --- |
| `/api/v1/admin/tdp/projections/batch-upsert` | correct local adapter for admin publisher | Keep and harden; treat as production-shaped publisher adapter |
| `/api/v1/tdp/terminals/{terminalId}/snapshot` | useful and aligned local retained-state inspection route | Keep and enrich metadata |
| `/api/v1/tdp/terminals/{terminalId}/changes` | useful and aligned local change feed route | Keep and enrich metadata |
| `/api/v1/admin/tdp/projections` | admin diagnostics route | Keep |
| `/api/v1/admin/tdp/change-logs` | admin diagnostics route | Keep |
| `/api/v1/admin/tdp/commands` | admin diagnostics route | Keep |

## 10. Phase-0 Exit Criteria

Phase 0 is complete only when:

1. New implementation work uses the real route namespaces listed above as the
   target contract.
2. Old mock-only admin routes are treated as transitional diagnostics, not as
   the primary business API.
3. The TDP publisher adapter contract is frozen around:
   `topic`, `scope`, `item`, `source_event_id`, `source_revision`,
   `source_release_id`, `occurred_at`, pagination/cursor metadata, and
   allowlist-only terminal payload semantics.
4. Any newly added server route in this task must update this matrix if it
   intentionally deviates from the source service design.
