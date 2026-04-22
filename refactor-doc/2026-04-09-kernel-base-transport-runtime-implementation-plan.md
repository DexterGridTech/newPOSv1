# Kernel Base Transport Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `transport-runtime` so the new architecture has one explicit HTTP/WS transport base with declarative endpoint and socket profile contracts, late-bound server resolution, retry/failover execution policy, and transport-scoped observability.

**Architecture:** `transport-runtime` will stay below topology semantics. It will expose declarative HTTP and WS contracts, a late-bound server catalog, a runtime-scoped HTTP caller, and a runtime-scoped socket manager. This phase implements transport connection/session/channel behavior only, and explicitly excludes request owner truth, projection aggregation, and business completion semantics.

**Tech Stack:** TypeScript 5, Yarn workspace package, `@impos2/kernel-base-contracts`, `@impos2/kernel-base-platform-ports`, `vitest`, package-local `tsx` scenario verification

---

## Reuse Rule

`_old_/1-kernel/1.1-cores/communication` already contains mature HTTP and WS foundation work. `transport-runtime` should inherit and adapt that work whenever it already matches the target semantics, instead of rebuilding equivalent machinery from scratch.

Reuse policy for this phase:

- Reuse the proven foundation patterns from old `communication` first, especially:
  - `HttpEndpointDefinition`
  - `defineHttpEndpoint`
  - `buildHttpUrl`
  - `ServerResolver`
  - `HttpExecutionController`
  - `HttpRuntime`
  - `SocketConnectionProfile`
  - `defineSocketProfile`
  - `SocketRuntime`
  - connection state / message dispatch / codec / metrics ideas
- Adapt naming, public contracts, and runtime ownership so they comply with the new `1-kernel/1.1-base/*` architecture.
- Remove or redesign any part that leaks old global runtime assumptions, old manager facades, or topology / request-completion semantics.
- Do not chase novelty for its own sake. “New package” does not mean “rebuild every wheel”.

## File Map

### `1-kernel/1.1-base/transport-runtime`

**Create:**

- `1-kernel/1.1-base/transport-runtime/package.json`
- `1-kernel/1.1-base/transport-runtime/tsconfig.json`
- `1-kernel/1.1-base/transport-runtime/src/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/moduleName.ts`
- `1-kernel/1.1-base/transport-runtime/src/generated/packageVersion.ts`
- `1-kernel/1.1-base/transport-runtime/src/application/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/features/commands/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/features/actors/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/features/slices/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/serverCatalog.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/httpEndpoint.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/httpRuntime.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/httpPolicy.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/socketProfile.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/socketRuntime.ts`
- `1-kernel/1.1-base/transport-runtime/src/foundations/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/selectors/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/hooks/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/supports/index.ts`
- `1-kernel/1.1-base/transport-runtime/src/types/http.ts`
- `1-kernel/1.1-base/transport-runtime/src/types/socket.ts`
- `1-kernel/1.1-base/transport-runtime/src/types/server.ts`
- `1-kernel/1.1-base/transport-runtime/src/types/runtime.ts`
- `1-kernel/1.1-base/transport-runtime/src/types/index.ts`
- `1-kernel/1.1-base/transport-runtime/test/index.ts`
- `1-kernel/1.1-base/transport-runtime/test/scenarios/http-runtime.spec.ts`
- `1-kernel/1.1-base/transport-runtime/test/scenarios/socket-runtime.spec.ts`

---

## Task 1: Scaffold `transport-runtime` and lock its public boundary

**Files:**

- Create: `1-kernel/1.1-base/transport-runtime/*`
- Modify: `1-kernel/1.1-base/transport-runtime/package.json`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/http.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/socket.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/server.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/runtime.ts`

- [ ] Use the workspace scaffolder to create the package skeleton under `1-kernel/1.1-base/transport-runtime`.
- [ ] Keep dependencies limited to `contracts` and `platform-ports`.
- [ ] Define public contract groups for:
  - HTTP endpoint declarations
  - HTTP transport requests and execution policy
  - WS socket profiles and connection state/events
  - late-bound server catalog / address resolution
  - transport runtime facades
- [ ] Keep `hooks/index.ts` as a rule-marker file only.
- [ ] Review old `communication` HTTP/WS foundations and explicitly classify each core capability as:
  - inherit directly
  - adapt into new contract
  - drop because it violates the new boundary

**Acceptance:**

- `transport-runtime` has one clear transport-only API surface.
- No request owner or topology concepts appear in public contracts.

---

## Task 2: Implement late-bound server catalog and HTTP declaration language

**Files:**

- Create: `1-kernel/1.1-base/transport-runtime/src/foundations/serverCatalog.ts`
- Create: `1-kernel/1.1-base/transport-runtime/src/foundations/httpEndpoint.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/http.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/server.ts`

- [ ] Implement declarative server/address contracts with:
  - server name
  - ordered addresses
  - timeout
  - metadata
- [ ] Reuse the proven `ServerResolver` and path-template thinking from old `communication`, but rename and trim them to the new transport-only contract.
- [ ] Implement a runtime-scoped server catalog that supports:
  - register one server
  - replace all servers
  - resolve one server
  - resolve ordered addresses
- [ ] Implement HTTP declaration helpers for:
  - endpoint definition
  - path placeholder interpolation
  - query serialization
  - URL assembly
- [ ] Keep server resolution late-bound so address selection can refresh before each call.

**Acceptance:**

- HTTP definitions remain declarative and side-effect free.
- Server addresses are resolved at execution time, not frozen at definition time.

---

## Task 3: Implement HTTP runtime with retry/failover/metrics

**Files:**

- Create: `1-kernel/1.1-base/transport-runtime/src/foundations/httpPolicy.ts`
- Create: `1-kernel/1.1-base/transport-runtime/src/foundations/httpRuntime.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/http.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/runtime.ts`

- [ ] Implement transport-scoped HTTP execution policy with:
  - max concurrent
  - rate limit window
  - retry rounds
  - failover across ordered addresses
- [ ] Reuse the proven `HttpExecutionController` and `HttpRuntime` behavior from old `communication` where the semantics already match the new package boundary.
- [ ] Implement `createHttpRuntime(...)` with:
  - runtime-scoped logger
  - late-bound server catalog refresh
  - transport adapter execution
  - metrics recording
  - structured transport errors
- [ ] Ensure one HTTP call records:
  - start/end time
  - duration
  - attempts
  - selected address
  - success/failure
- [ ] Keep return semantics at pure transport level: status/data/headers only.

**Acceptance:**

- HTTP runtime can retry and fail over without leaking topology semantics.
- Logger context includes transport identifiers like endpoint/server/address.

---

## Task 4: Implement socket profile language and socket runtime

**Files:**

- Create: `1-kernel/1.1-base/transport-runtime/src/foundations/socketProfile.ts`
- Create: `1-kernel/1.1-base/transport-runtime/src/foundations/socketRuntime.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/socket.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/src/types/runtime.ts`

- [ ] Implement declarative socket profiles with:
  - profile name
  - server name
  - path template
  - handshake query/headers
  - codec
  - heartbeat/reconnect config
- [ ] Reuse the proven `SocketConnectionProfile`, `SocketRuntime`, codec, metrics, and connection-state ideas from old `communication` where they still fit the new transport boundary.
- [ ] Implement a runtime-scoped socket manager that supports:
  - register profile
  - connect
  - send
  - receive
  - disconnect
  - get connection state
- [ ] Implement reconnect behavior driven only by transport reasons and profile policy.
- [ ] Record socket metrics and structured log events with connection/session/channel context.

**Acceptance:**

- WS runtime manages connection/session/channel behavior only.
- Reconnect behavior is transport-scoped and does not infer business completion.

---

## Task 5: Verify package behavior and update progress docs

**Files:**

- Modify: `1-kernel/1.1-base/transport-runtime/test/index.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/test/scenarios/http-runtime.spec.ts`
- Modify: `1-kernel/1.1-base/transport-runtime/test/scenarios/socket-runtime.spec.ts`
- Modify: `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md`

- [ ] Replace placeholder verification entry with formal `test/` structure that verifies:
  - late-bound HTTP server resolution
  - HTTP failover after first address failure
  - socket profile registration and connect/send/receive/disconnect flow
  - socket reconnect after a transport-level disconnect reason
- [ ] Run:
  - `corepack yarn type-check` in `1-kernel/1.1-base/transport-runtime`
  - `corepack yarn test` in `1-kernel/1.1-base/transport-runtime`
  - `corepack yarn test:scenario` in `1-kernel/1.1-base/transport-runtime`
- [ ] Update the progress summary doc so `transport-runtime` becomes “completed first-pass” and the next step changes to `dual-topology-host`.

**Acceptance:**

- `transport-runtime` passes package-local verification.
- Progress docs match the actual repository state.
