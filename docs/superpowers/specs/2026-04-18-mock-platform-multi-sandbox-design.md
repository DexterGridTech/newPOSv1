# `mock-terminal-platform` Multi-Sandbox Design

## Background

The current mock platform already stores most business data with `sandbox_id` at the database layer, but the effective runtime model is still single-sandbox.

The root cause is not the schema. The root cause is that business services and the TDP WebSocket handshake still resolve sandbox context from server-global runtime state:

1. `server/src/modules/*/service.ts` widely call `getCurrentSandboxId()`
2. `server/src/modules/tdp/wsServer.ts` binds TDP sessions to whatever sandbox is currently selected on the server
3. the admin web app presents a current sandbox selector, but that selector also acts as hidden business truth
4. the client runtimes do not persist an explicit sandbox context, so restart recovery cannot prove which sandbox a session belongs to

This model prevents true concurrent reuse of one server process across multiple sandboxes.

The new design changes the contract completely:

1. every HTTP request and every WebSocket connection must carry an explicit `sandboxId`
2. server business behavior must never depend on a server-global current sandbox
3. admin UI may still expose a "current sandbox" experience, but only as a client-side default value
4. terminal activation must require the user to enter a sandbox ID, and that sandbox ID must be persisted in client state

## Goals

1. Make every sandbox independently active without affecting any other sandbox
2. Require explicit `sandboxId` on all server APIs, including TDP WebSocket
3. Remove server-global current sandbox from business semantics
4. Keep admin-console UX close to the current experience by using current sandbox only as a UI default
5. Persist sandbox context on the client so TCP and TDP restart recovery remain correct
6. Prove isolation with live tests covering concurrent multi-sandbox clients

## Non-goals

1. Do not redesign the database schema around new multi-tenant tables; existing `sandbox_id` columns are sufficient for this phase
2. Do not add cross-sandbox batch APIs in this phase
3. Do not keep long-term backward compatibility with sandbox-implicit terminal APIs
4. Do not split one terminal session across multiple sandboxes
5. Do not make TDP maintain a second independent sandbox truth source separate from TCP control runtime

## Design Principle

The system moves from:

`server-global current sandbox -> service lookup -> DB query`

to:

`request/connection explicit sandboxId -> router parse -> service input -> DB query`

This is the most important rule of the whole change.

After this refactor:

1. `current sandbox` is a web-admin preference, not business truth
2. all business services must receive `sandboxId` explicitly
3. all in-memory session registries and push routes must isolate by `sandboxId`
4. client state must treat `sandboxId` as part of the minimum recovery truth source

## API Contract

### HTTP rules

To keep protocol usage simple and visible in logs:

1. `GET` APIs carry `sandboxId` in query
2. `POST/PUT/PATCH/DELETE` APIs carry `sandboxId` in request body
3. key resource responses should include `sandboxId` when the object is sandbox-scoped

### WebSocket rules

TDP WebSocket must carry sandbox context at connection time:

1. query must include `sandboxId`
2. `HANDSHAKE.data` must include the same `sandboxId`
3. server must reject mismatches immediately with protocol error
4. terminal, token, and sandbox ownership must be validated before the connection is registered as an online business session
5. after handshake success, the session's sandbox is fixed for the lifetime of the connection

### Error codes

The server should define explicit protocol errors:

1. `SANDBOX_ID_REQUIRED`
2. `SANDBOX_NOT_FOUND`
3. `SANDBOX_INACTIVE`
4. `SANDBOX_ID_MISMATCH`
5. `SANDBOX_TERMINAL_MISMATCH`
6. `SANDBOX_SESSION_MISMATCH`

## Server Architecture

### 1. Request sandbox resolution

Introduce a thin server-side request parsing layer, for example:

1. `resolveRequiredSandboxId(req)`
2. `resolveOptionalSandboxId(req)`
3. `assertSandboxUsable(sandboxId)`

Rules:

1. business routes must resolve sandbox before calling services
2. services must not call `getCurrentSandboxId()` anymore
3. admin UI adapter routes must also receive explicit sandbox ID from the web client
4. no business route, including admin routes, may fallback to runtime current sandbox
5. terminal-facing APIs and TDP WebSocket must reject missing sandbox ID immediately

### 2. Service signature changes

All business services should accept explicit sandbox context in one of two styles:

```ts
listTerminals({ sandboxId })
activateTerminal({ sandboxId, activationCode, deviceFingerprint, deviceInfo })
connectSession({ sandboxId, terminalId, clientVersion, protocolVersion })
```

or:

```ts
activateTerminal(input, { sandboxId })
```

For this repo, the first style is preferred because it stays explicit and readable inside mock platform services.

### 3. Remove global sandbox business reads

The following modules must stop reading `getCurrentSandboxId()` for business execution:

1. `server/src/modules/tcp/service.ts`
2. `server/src/modules/tdp/service.ts`
3. `server/src/modules/master-data/service.ts`
4. `server/src/modules/fault/service.ts`
5. `server/src/modules/export/service.ts`
6. `server/src/modules/export/importService.ts`
7. `server/src/modules/admin/audit.ts` if audit logs remain sandbox-scoped

`server/src/modules/sandbox/service.ts` still owns:

1. sandbox CRUD
2. runtime context read/write for admin UI default selection
3. sandbox existence and status validation helpers

### 4. WebSocket in-memory isolation

Current in-memory routing is still risky because online session lookup is keyed only by `terminalId`.

This must change to sandbox-aware routing.

Required changes:

1. `listOnlineSessionsByTerminalId(terminalId)` becomes `listOnlineSessionsBySandboxTerminalId(sandboxId, terminalId)`
2. push helpers accept `{ sandboxId, terminalId }`
3. projection batch queues are isolated per sandbox and terminal
4. force-close and admin control signals validate that target session belongs to the declared sandbox
5. a WebSocket connection must not be inserted into the online session registry until sandbox, terminal, and token validation all succeed

Without this change, two sandboxes that reuse the same terminal ID could still leak messages across sessions even if the database layer is correct.

## Server API Changes

### TCP terminal APIs

All terminal control-plane APIs must require explicit sandbox ID.

#### `POST /api/v1/terminals/activate`

Request body:

```ts
{
  sandboxId: string
  activationCode: string
  deviceFingerprint: string
  deviceInfo: Record<string, unknown>
}
```

Response should include:

```ts
{
  terminalId: string
  token: string
  refreshToken: string
  sandboxId: string
  expiresIn: number
  refreshExpiresIn?: number
  binding?: TcpBindingContext
}
```

#### `POST /api/v1/terminals/token/refresh`

Request body:

```ts
{
  sandboxId: string
  refreshToken: string
}
```

Validation must confirm the credential belongs to a terminal in the same sandbox.

The preferred implementation is database ownership validation, not token format mutation.

That means:

1. do not encode sandbox ID into token format in this phase
2. resolve credential ownership by looking up the credential, then resolving terminal ownership, then validating sandbox match
3. keep existing token shapes valid unless a separate auth redesign is intentionally scheduled

#### `POST /api/v1/terminals/:terminalId/deactivate`

Request body:

```ts
{
  sandboxId: string
  reason?: string
}
```

#### `POST /api/v1/terminals/:terminalId/tasks/:instanceId/result`

Request body:

```ts
{
  sandboxId: string
  status: string
  result?: unknown
  error?: unknown
}
```

### TDP HTTP APIs

#### `GET /api/v1/tdp/terminals/:terminalId/snapshot?sandboxId=...`

#### `GET /api/v1/tdp/terminals/:terminalId/changes?sandboxId=...&cursor=...&limit=...`

Both APIs must:

1. resolve sandbox explicitly from query
2. validate the terminal belongs to that sandbox
3. query projections and change logs using that sandbox only

### TDP compatibility/debug HTTP APIs

If `sessions/connect|heartbeat|disconnect` remain available:

1. they also require explicit `sandboxId`
2. they do not use current sandbox fallback

### Admin APIs

All admin APIs should also carry explicit `sandboxId`, even when the page looks like it operates on one current sandbox.

Examples:

1. `GET /api/v1/admin/terminals?sandboxId=...`
2. `GET /api/v1/admin/tdp/sessions?sandboxId=...`
3. `POST /api/v1/admin/tasks/releases` body contains `sandboxId`
4. `POST /api/v1/admin/tdp/projections/upsert` body contains `sandboxId`
5. `POST /api/v1/admin/tdp/sessions/:sessionId/force-close` body contains `sandboxId`

### TDP WebSocket

Connection URL changes from:

`/api/v1/tdp/ws/connect?terminalId=...&token=...`

to:

`/api/v1/tdp/ws/connect?sandboxId=...&terminalId=...&token=...`

Handshake changes from:

```ts
{
  type: 'HANDSHAKE',
  data: {
    terminalId: string
    appVersion: string
    lastCursor?: number
    protocolVersion?: string
    capabilities?: string[]
    subscribedTopics?: string[]
  }
}
```

to:

```ts
{
  type: 'HANDSHAKE',
  data: {
    sandboxId: string
    terminalId: string
    appVersion: string
    lastCursor?: number
    protocolVersion?: string
    capabilities?: string[]
    subscribedTopics?: string[]
  }
}
```

Server validation rules:

1. query `sandboxId` is required
2. handshake `data.sandboxId` is required
3. query and handshake values must match
4. handshake terminalId and query terminalId must match
5. token must resolve to the same terminal identity as the handshake terminalId
6. terminal and token must belong to the declared sandbox
7. only after all checks succeed may the server create and register the online session

## Admin Web Design

The admin UI keeps the current high-level experience:

1. the page still has a "current sandbox" selector
2. list pages still display one sandbox at a time
3. operators do not need to manually type sandbox ID in every form

But implementation semantics change completely:

1. the selected sandbox becomes front-end default request context
2. every admin request explicitly includes `sandboxId`
3. switching the selected sandbox only changes future client requests
4. server runtime context no longer acts as business truth

### Front-end state

The page should treat sandbox as first-class state:

1. `uiCurrentSandboxId`
2. `runtimeContext.currentSandboxId`
3. request-scoped sandbox value injected into every API call

### API client

Prefer one sandbox-scoped API client wrapper over scattered manual request building.

For example:

```ts
const sandboxApi = createSandboxScopedApi(() => currentSandboxId)
```

Then page actions call:

1. `sandboxApi.getTerminals()`
2. `sandboxApi.createTaskRelease(payload)`
3. `sandboxApi.getTerminalSnapshot(terminalId)`

This still sends explicit sandbox ID on the wire, but avoids human error in dozens of handlers.

### Release constraint

The admin web client and the server-side sandbox-required protocol must be shipped as one release slice.

That means:

1. do not merge a server change that hard-requires sandbox ID while the web client still omits it
2. do not reintroduce server fallback to current sandbox to paper over rollout gaps
3. treat `admin web request update + server protocol enforcement` as one atomic migration step

### Page switching behavior

When the user switches current sandbox:

1. update current sandbox UI state
2. rerun full page reload with the new sandbox
3. clear stale detail views bound to the previous sandbox

Detail data that should be reset includes:

1. task trace
2. terminal snapshot
3. terminal changes
4. selected master-data entity
5. edit forms bound to previous sandbox objects

## Client Runtime Design

### Terminal activation must collect sandbox ID

Client activation flow must require the user to input sandbox ID together with activation code.

This applies to:

1. real UI activation form
2. live tests
3. manual debug harnesses

### `tcp-control-runtime-v2`

The client needs a persistent sandbox truth source.

Recommended design:

1. add a dedicated sandbox slice such as `tcpSandbox`
2. persist `sandboxId`
3. do not sync it
4. treat it as minimum recovery truth source for later TCP and TDP requests

Suggested state:

```ts
type TcpSandboxState = {
  sandboxId?: string
}
```

This is better than hiding sandbox inside `tcpBinding`, because sandbox is environment context, not store/platform binding.

The first version should keep this state minimal.
Do not add timestamp fields until a concrete read path needs them.

### TCP command and actor changes

`activateTerminal` command should accept sandbox ID explicitly:

```ts
{
  activationCode: string
  sandboxId: string
  deviceFingerprint?: string
  deviceInfo?: TcpDeviceInfo
}
```

Flow:

1. user enters `sandboxId`
2. activation actor sends `sandboxId` to server
3. on success, runtime persists `sandboxId`
4. later `refreshCredential`, `deactivateTerminal`, and `reportTaskResult` reuse persisted sandbox ID by default

If no sandbox ID exists during those later operations, runtime should fail explicitly rather than guessing.

### Dual-screen / multi-process rule

This repo has real dual-screen and multi-process runtime scenarios.

For this design, sandbox truth must remain single-source and product-consistent:

1. one activated terminal environment corresponds to one sandbox
2. primary and secondary processes must not diverge onto different sandboxes for the same activated terminal
3. if a secondary process needs sandbox context for any TCP or TDP behavior, that context must be available through the same runtime truth path used by the primary process

Implementation must choose one of the following and make it explicit:

1. only the primary process owns TCP/TDP connection responsibilities, while secondary consumes already-synchronized business state
2. sandbox context is synchronized/shared so secondary can read the same sandbox truth safely

The implementation must not leave secondary to depend on a sandbox state that is marked non-sync but still required for connection logic.

### TCP API types

The following client request types must include `sandboxId`:

1. `ActivateTerminalApiRequest`
2. `RefreshTerminalCredentialApiRequest`
3. `DeactivateTerminalApiRequest`
4. `ReportTaskResultApiRequest`

### `tdp-sync-runtime-v2`

TDP should not maintain a second independent sandbox truth source.

Instead:

1. TDP reads sandbox ID from TCP sandbox state
2. snapshot/changes requests include sandbox ID
3. socket query includes sandbox ID
4. handshake data includes sandbox ID

If terminal ID or access token exists but sandbox ID is missing, TDP must not auto-connect. That state is considered corrupted recovery input.

### Restart recovery rules

Recommended recovery semantics:

1. `sandboxId` is part of the persistent control-plane truth source
2. restart recovery reuses the same persisted sandbox ID
3. TDP incremental recovery is only allowed when terminal identity, token, cursor, and sandbox ID all belong together
4. if sandbox ID is missing while terminal credentials remain, recovery fails fast and asks for reactivation or explicit sandbox reset

### Optional explicit sandbox switch command

To support future environment changes cleanly, add a formal command such as:

1. `setSandboxContext`
2. or `switchSandboxContext`

That command should:

1. update persisted sandbox ID
2. clear terminal identity, credential, and binding that belong to the previous sandbox
3. clear persisted TDP recovery position that belongs to the previous sandbox, including `lastCursor`
4. reset TDP session runtime, command inbox, and control signals tied to the previous sandbox
5. define whether local projection repository is cleared immediately or partitioned by sandbox; the implementation must not leave old sandbox projection data active under the new sandbox
6. explicitly define how in-flight task/report flows are handled during sandbox switching; default recommendation is fail-fast and clear local runtime observations rather than silently carrying them across sandboxes
7. put the app into "sandbox selected, terminal not activated" state

The default first-phase behavior should be strict:

1. switching sandbox is treated as environment reset
2. old sandbox cursor must be cleared, not reused
3. old sandbox session and projection runtime state must not remain active

## Test Strategy

### 1. Live harness changes

`tcp-control-runtime-v2/test/helpers/liveHarness.ts` and `tdp-sync-runtime-v2/test/helpers/liveHarness.ts` must become sandbox-explicit.

Required behavior:

1. `createLivePlatform()` returns prepared `sandboxId`
2. every admin helper sends that sandbox ID explicitly
3. terminal activation helper requires `sandboxId`
4. test failure occurs if sandbox ID is missing

### 2. Activation and persistence tests

TCP live tests must prove:

1. activation requires explicit sandbox ID
2. sandbox ID is stored in client state
3. persisted storage contains sandbox ID
4. refresh/deactivate/report task reuse that sandbox ID

### 3. TDP connection tests

TDP live tests must prove:

1. WebSocket query contains sandbox ID
2. handshake contains the same sandbox ID
3. session rows are created under that sandbox
4. snapshot and changes only return data from that sandbox

### 4. Multi-sandbox isolation tests

Add one core scenario:

1. create sandbox A and sandbox B
2. activate client A in sandbox A
3. activate client B in sandbox B
4. connect both to TDP simultaneously
5. publish the same topic/item structure in both sandboxes with different payloads
6. assert each client only receives its own sandbox data

This is the primary acceptance test for the entire design.

### 5. TCP and admin cross-sandbox isolation tests

In addition to TDP projection isolation, tests must cover control-plane isolation.

Required scenarios:

1. sandbox A and sandbox B each have an activated terminal
2. a control-plane action declared with sandbox A must not be able to mutate sandbox B resources
3. examples include force-closing a session, reporting a task result, or operating on task release / task instance state across sandbox boundaries
4. the server should return explicit mismatch errors rather than silently operating on the wrong resource

### 6. Restart recovery tests

Recovery tests must verify:

1. seed phase activates with explicit sandbox ID
2. persisted state contains sandbox ID
3. verify phase restores sandbox ID
4. TDP restart recovery continues with the same sandbox
5. missing sandbox ID plus existing credentials is rejected as invalid recovery state

### 7. Sandbox switch tests

If sandbox switching command is implemented, tests must prove:

1. switching sandbox clears old identity and credentials
2. switching sandbox resets TDP runtime state
3. new sandbox activation then succeeds cleanly

## Migration Plan

Recommended order:

1. refactor server services to accept explicit sandbox ID
2. refactor WebSocket session registry to isolate by sandbox and terminal
3. update admin web API client to inject explicit sandbox ID everywhere
4. change server HTTP and WS protocols to require explicit sandbox ID
5. add client persistent sandbox state and activation sandbox input
6. update TDP runtime to reuse client sandbox state
7. add multi-sandbox live tests and restart recovery coverage
8. update docs and examples

### Smallest valuable slice

The first minimal end-to-end slice should cover:

1. terminal activation with explicit sandbox ID
2. TCP credential refresh with explicit sandbox ID
3. TDP snapshot/changes with explicit sandbox ID
4. TDP WebSocket query and handshake with explicit sandbox ID
5. one dual-sandbox live TDP isolation test
6. one cross-sandbox TCP/admin isolation test

If this slice passes, the overall architecture is proven.

## Risks

### 1. In-memory routing leakage

Database isolation is already mostly present.
The highest risk is in-memory push routing by `terminalId` only.

This must be fixed first.

### 2. Corrupted restart state

Persisting terminal identity and cursor without sandbox ID would make recovery ambiguous.

Sandbox ID must become part of the minimum persisted truth source.

### 3. Admin request omission

The admin web app has many action buttons and forms.
Without a scoped API wrapper, some requests will inevitably forget sandbox ID.

### 4. Hidden fallback re-entering the system

Any fallback from missing sandbox ID to current sandbox would reintroduce the old single-sandbox model.
The server should reject missing sandbox ID instead of silently completing the request.

## Acceptance Criteria

The design is complete only when all of the following are true:

1. no business service relies on `getCurrentSandboxId()` anymore
2. every HTTP and WS API explicitly carries sandbox ID
3. admin current sandbox is only a client-side default selection
4. terminal activation requires sandbox ID input from the user
5. client persists sandbox ID in state
6. TDP reconnect and restart recovery require the same persisted sandbox ID
7. two sandboxes can run concurrent TCP/TDP sessions on one server without message leakage
8. live tests prove projection, command, session, and recovery isolation across sandboxes

## Summary

The refactor turns sandbox from hidden global process state into explicit protocol state.

That single change aligns all layers:

1. server business logic becomes deterministic
2. admin UI keeps its current operator ergonomics
3. client recovery semantics become correct
4. one server process can safely host multiple independent sandboxes at once

---

## Sandbox Data Model

### Sandbox record fields

Each sandbox record contains:

```ts
{
  sandboxId: string           // unique identifier, e.g. 'sandbox-abc123'
  name: string                // unique, case-insensitive
  description: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  isSystemDefault: boolean    // system default sandbox, protected from rename/disable
  creationMode: 'EMPTY' | 'CLONE_BASELINE'
  sourceSandboxId: string | null  // set when creationMode is CLONE_BASELINE
  seed: number | null         // timestamp used as creation seed
  ownerUserId: string
  ownerTeamId: string
  purpose: string             // e.g. 'kernel-base-test', 'staging', 'demo'
  resourceLimits: {
    maxTerminals?: number
    maxTasks?: number
    maxFaultRules?: number
    maxStorageSize?: string
  }
  createdBy: string
  createdAt: number
  updatedAt: number
}
```

### Sandbox status machine

```
ACTIVE ──pause──> PAUSED ──resume──> ACTIVE
ACTIVE ──archive──> ARCHIVED
PAUSED ──archive──> ARCHIVED
```

Rules:

1. only `ACTIVE` sandboxes can be used for business operations
2. `assertSandboxUsable(sandboxId)` checks both existence and `status === 'ACTIVE'`
3. `assertSandboxExists(sandboxId)` only checks existence, used for admin read operations
4. the system default sandbox (`isSystemDefault = true`) cannot be renamed or disabled
5. the currently selected admin sandbox cannot be disabled directly; operator must switch to another sandbox first

### Sandbox name uniqueness

Sandbox names are unique case-insensitively across the entire server. Duplicate name check uses `LOWER(name) = LOWER(?)`.

---

## Sandbox Creation Modes

### EMPTY mode

Creates a sandbox with no business data. The operator must manually create master data (platforms, tenants, brands, projects, stores) before activating terminals.

### CLONE_BASELINE mode

Clones all baseline master data from a source sandbox into the new sandbox. The source sandbox must be `ACTIVE`.

Cloned object types (in dependency order):

1. platforms
2. tenants (references platform)
3. brands (references platform)
4. projects (references platform)
5. stores (references platform, tenant, brand, project)
6. contracts (references platform, project, tenant, brand, store)
7. terminal profiles
8. terminal templates (references profile)
9. TDP topics
10. fault rules

Clone rules:

1. every cloned object gets a new ID generated by `createId(prefix)`
2. ID remapping is maintained per object type: `platformIdMap`, `tenantIdMap`, `brandIdMap`, `projectIdMap`, `storeIdMap`, `profileIdMap`
3. foreign key references within cloned objects are rewritten using the ID maps
4. if a foreign key is not found in the map (e.g. source data inconsistency), the original ID is kept as fallback
5. `hitCount` on fault rules is reset to 0 in the clone
6. terminals, activation codes, task releases, sessions, projections, and change logs are NOT cloned

### What is not cloned

The following are intentionally excluded from CLONE_BASELINE:

1. terminals — each sandbox must activate its own terminals
2. activation codes — must be created fresh per sandbox
3. task releases and instances — operational data, not baseline
4. TDP sessions, projections, change logs — runtime data
5. audit logs — not carried across sandboxes
6. terminal credentials — no `sandbox_id` column, owned through terminal

---

## Sandbox Lifecycle: Cascade Delete

When a sandbox is deleted or reset, rows must be removed in the following order to respect foreign key constraints:

```
audit_logs
fault_rules
tdp_command_outbox
tdp_change_logs
tdp_projections
tdp_topics
tdp_sessions
task_releases
activation_codes
terminal_instances
terminal_templates
terminal_profiles
contracts
stores
projects
brands
tenants
platforms
```

After the above, two additional steps are required:

1. collect all `terminal_id` values from `terminal_instances` before deletion, then delete matching rows from `terminal_credentials` (which has no `sandbox_id` column)
2. collect all `release_id` values from `task_releases` before deletion, then delete matching rows from `task_instances` (which references `release_id`, not `sandbox_id`)

### Why terminal_credentials has no sandbox_id

`terminal_credentials` is intentionally designed without a `sandbox_id` column. Sandbox ownership is validated by looking up the terminal and checking its `sandbox_id`, not by encoding sandbox into the token format.

This means:

1. token format does not change when sandbox changes
2. sandbox validation during token refresh is: look up credential → look up terminal → check `terminal.sandbox_id === input.sandboxId`
3. cascade delete must go through terminal IDs, not sandbox ID

---

## Test Sandbox Seed Mechanism

### prepareKernelBaseTestSandbox

This is an idempotent operation used by automated tests to reset the test sandbox to a known state.

Behavior:

1. if the sandbox record does not exist, create it with a fixed `sandboxId = 'sandbox-kernel-base-test'`
2. delete all existing data rows for that sandbox (using the cascade delete order above)
3. insert a fixed set of seed data with deterministic IDs
4. switch the admin runtime context to this sandbox

The seed data includes:

- 1 platform: `platform-kernel-base-test`
- 1 tenant: `tenant-kernel-base-test`
- 1 brand: `brand-kernel-base-test`
- 1 project: `project-kernel-base-test`
- 1 store: `store-kernel-base-test`
- 1 contract: `contract-kernel-base-test`
- 1 terminal profile: `profile-kernel-base-android-pos`
- 1 terminal template: `template-kernel-base-android-pos-standard`
- 12 activation codes: `200000000001` through `200000000012`
- 7 TDP topics: `tcp.task.release`, `terminal.config.state`, `config.delta`, `menu.delta`, `printer.delta`, `remote.control`, `print.command`

### Why idempotent seed matters

Tests must be able to call `prepareKernelBaseTestSandbox` at the start of each test run without worrying about leftover state from previous runs. The delete-then-insert pattern guarantees a clean slate with deterministic IDs every time.

---

## Master Data: Cross-Entity Reference Validation

### Platform-scoped entity rule

All entities below platform (tenant, brand, project, store, contract) must belong to the same platform. When creating or updating a store or contract, the service validates:

```
tenant.platformId === input.platformId
brand.platformId === input.platformId
project.platformId === input.platformId
store.platformId === input.platformId  (for contract)
```

This is enforced by `ensurePlatformScopedEntity(entityName, expectedPlatformId, actualPlatformId)`.

### Store relation consistency

When creating a store, the service validates that tenant, brand, and project all exist within the same sandbox and belong to the same platform.

When creating a contract, the service additionally validates that the store's `projectId`, `tenantId`, and `brandId` match the contract's declared values.

### Deletion pre-checks

Entities cannot be deleted if they have downstream references. The checks are:

| Entity | Blocked by |
|--------|-----------|
| platform | projects, tenants, brands, stores, contracts |
| tenant | stores, contracts, activation codes, terminals |
| brand | stores, contracts, activation codes, terminals |
| project | stores, contracts, activation codes, terminals |
| store | contracts, activation codes, terminals |
| terminal profile | templates, activation codes, terminals |
| terminal template | activation codes, terminals |

These checks use `sandboxId` + entity ID to scope the lookup, ensuring cross-sandbox false positives cannot block deletion.

---

## TDP Data Plane: Scope Resolution

### scopeType values

When a projection is upserted, the server resolves which terminals should receive the change based on `scopeType` and `scopeKey`:

| scopeType | scopeKey | Target terminals |
|-----------|----------|-----------------|
| `TERMINAL` | terminalId | exactly that terminal |
| `STORE` | storeId | all terminals in that store |
| `TENANT` | tenantId | all terminals belonging to that tenant |
| `BRAND` | brandId | all terminals belonging to that brand |
| `PROJECT` | projectId | all terminals belonging to that project |
| `PLATFORM` | platformId | all terminals belonging to that platform |

All terminal lookups are scoped by `sandboxId`. A projection upsert in sandbox A cannot affect terminals in sandbox B even if they share the same `storeId` value.

### Change log cursor

Each change log entry has a monotonically increasing `cursor` per `(sandboxId, terminalId)` pair. The cursor is computed as `MAX(cursor) + 1` from existing change logs for that terminal.

The `highWatermark` for a terminal is the maximum cursor value in its change log. This is used during WebSocket handshake to determine sync mode:

- if `lastCursor === 0` or `lastCursor < highWatermark - 1000`: use `full` sync (send full snapshot)
- otherwise: use `incremental` sync (send changes since `lastCursor`)

---

## TDP Push: Batch Window

### 120ms batch window

When a projection change is pushed to an online terminal, the server does not send immediately. Instead it queues the change and sets a 120ms timer. When the timer fires, all queued changes are flushed:

- if 1 change in queue: send `PROJECTION_CHANGED` message
- if 2+ changes in queue: send `PROJECTION_BATCH` message

This reduces WebSocket message count when multiple projections are upserted in rapid succession (e.g. a batch upsert of 10 items sends 1 `PROJECTION_BATCH` instead of 10 `PROJECTION_CHANGED`).

### Batch upsert flush

`upsertProjectionBatch` collects all queued changes per terminal, then calls `flushProjectionQueueToOnlineTerminal` for each terminal after all projections are processed. This ensures one flush per terminal per batch call regardless of how many items target that terminal.

---

## TDP ACK Side Effects

When the client sends an `ACK` message, the server updates session state and may trigger additional side effects based on the topic:

### tcp.task.release

```
ACK { topic: 'tcp.task.release', itemKey: instanceId }
→ task_instances.delivery_status = 'ACKED'
→ task_instances.delivered_at = now()
```

### remote.control / print.command

```
ACK { topic: 'remote.control' | 'print.command', itemKey: commandId }
→ tdp_command_outbox.status = 'ACKED'
→ tdp_command_outbox.acked_at = now()
→ if command.payload.instanceId exists:
    task_instances.delivery_status = 'ACKED'
    task_instances.delivered_at = now()
```

These side effects are scoped by the `itemKey` value only, not by `sandboxId`. The assumption is that `instanceId` and `commandId` are globally unique (generated by `createId()`), so cross-sandbox collision is not possible in practice.

---

## REMOTE_CONTROL Task Dispatch Path

Tasks with `taskType === 'REMOTE_CONTROL'` follow a different dispatch path from regular projection tasks.

### Regular task dispatch (PROJECTION path)

1. write/update projection in `tdp_projections`
2. write change log entry in `tdp_change_logs`
3. push `PROJECTION_CHANGED` or `PROJECTION_BATCH` to online terminal
4. update `task_instances.delivery_status = 'DELIVERED'`

### REMOTE_CONTROL dispatch (COMMAND path)

1. write command entry in `tdp_command_outbox` with `status = 'DELIVERED'`, `expires_at = now + 10min`
2. push `COMMAND_DELIVERED` message directly to online terminal WebSocket
3. update `task_instances.delivery_status = 'DELIVERED'`
4. no projection is written — command is ephemeral

The `topicKey` for the command defaults to `'remote.control'` but can be overridden by `payload.topicKey` (e.g. `'print.command'`).

Commands expire after 10 minutes. Expired commands are not re-delivered on reconnect.

---

## Audit Log Sandbox Attribution

`appendAuditLog` accepts an optional `sandboxId` parameter:

```ts
appendAuditLog({
  sandboxId?: string   // if omitted, falls back to getCurrentSandboxId()
  domain: string
  action: string
  operator?: string
  targetId: string
  detail: unknown
})
```

After the sandbox-explicit refactor, all callers that operate on a specific sandbox must pass `sandboxId` explicitly. Relying on the fallback `getCurrentSandboxId()` is only acceptable for admin dashboard operations that are already scoped to the current sandbox by design.

---

## Admin Interface: current sandbox exceptions

Most admin APIs must carry explicit `sandboxId`. However, two categories of admin interfaces are allowed to use `getCurrentSandboxId()` as an implicit scope:

### Allowed exceptions (dashboard-class interfaces)

1. `getPlatformOverview()` — aggregates terminal, task, session, topic, and fault stats for the current sandbox. This is a read-only dashboard query; using current sandbox is acceptable because the admin UI always displays it in the context of the selected sandbox.

2. `listAuditLogs()` — returns audit log entries for the current sandbox. Same rationale as above.

### All other admin interfaces must be sandbox-explicit

Including but not limited to:

- terminal list, terminal status force-update, batch create terminals
- task release create, task instance create, task result report
- TDP session list, force-close session, send edge degraded
- projection upsert, projection list, change log list
- master data CRUD (platforms, tenants, brands, projects, stores, contracts, profiles, templates)
- fault rule CRUD
- export / import

---

## Export Module

`exportMockData(sandboxId)` exports a complete snapshot of all business data for a sandbox. It is already sandbox-explicit and does not use `getCurrentSandboxId()`.

Exported tables:

- platforms, tenants, brands, projects, stores, contracts
- TDP topics
- task releases, task instances
- fault rules
- audit logs (last 500 entries)

Not exported:

- terminals (operational, not baseline)
- activation codes (operational)
- TDP sessions, projections, change logs, command outbox (runtime state)
- terminal credentials (security-sensitive)
