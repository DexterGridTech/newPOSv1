# Dual Topology Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `0-mock-server/dual-topology-host` so the new architecture has one protocol-aligned dual-node development host for pairing, hello/ack, ordered relay, observability, and fault injection.

**Architecture:** `dual-topology-host` will act as a pure control-plane host. It will manage pairing tickets, validate hello/ack compatibility, establish host sessions, relay dispatch/event/projection-mirror envelopes in order, and expose structured host observation and fault injection controls. It will explicitly exclude request owner aggregation, business command execution, and request completion judgment.

**Tech Stack:** TypeScript 5, Yarn workspace package, Node runtime, package-local `vitest`, package-local `tsx` scenario verification

---

## Reuse Rule

`0-mock-server/master-ws-server-dual` already contains a working host-shaped mock service and should be treated as a source of proven host behavior rather than something to ignore.

Reuse policy for this phase:

- Reuse effective old host ideas first, especially:
  - connection/session management
  - heartbeat handling
  - retry queue / ordered relay thinking
  - structured host-side logging and monitoring hooks
- Adapt naming, protocol envelopes, and feature boundaries so they match the new `dual-topology-host` contract.
- Remove or redesign any old behavior that mixes host responsibilities with request semantics or old ad hoc message formats.

---

## File Map

### `0-mock-server/dual-topology-host`

**Create:**

- `0-mock-server/dual-topology-host/package.json`
- `0-mock-server/dual-topology-host/tsconfig.json`
- `0-mock-server/dual-topology-host/src/index.ts`
- `0-mock-server/dual-topology-host/src/moduleName.ts`
- `0-mock-server/dual-topology-host/src/generated/packageVersion.ts`
- `0-mock-server/dual-topology-host/src/application/index.ts`
- `0-mock-server/dual-topology-host/src/features/index.ts`
- `0-mock-server/dual-topology-host/src/features/pairing/index.ts`
- `0-mock-server/dual-topology-host/src/features/session/index.ts`
- `0-mock-server/dual-topology-host/src/features/relay/index.ts`
- `0-mock-server/dual-topology-host/src/features/observability/index.ts`
- `0-mock-server/dual-topology-host/src/features/fault-injection/index.ts`
- `0-mock-server/dual-topology-host/src/foundations/index.ts`
- `0-mock-server/dual-topology-host/src/foundations/createDualTopologyHost.ts`
- `0-mock-server/dual-topology-host/src/foundations/pairingRegistry.ts`
- `0-mock-server/dual-topology-host/src/foundations/sessionRegistry.ts`
- `0-mock-server/dual-topology-host/src/foundations/relayRouter.ts`
- `0-mock-server/dual-topology-host/src/foundations/observability.ts`
- `0-mock-server/dual-topology-host/src/foundations/faultInjection.ts`
- `0-mock-server/dual-topology-host/src/supports/index.ts`
- `0-mock-server/dual-topology-host/src/types/index.ts`
- `0-mock-server/dual-topology-host/src/types/host.ts`
- `0-mock-server/dual-topology-host/src/types/session.ts`
- `0-mock-server/dual-topology-host/src/types/fault.ts`
- `0-mock-server/dual-topology-host/test/index.ts`
- `0-mock-server/dual-topology-host/test/scenarios/pairing-and-hello.spec.ts`
- `0-mock-server/dual-topology-host/test/scenarios/relay-ordering.spec.ts`
- `0-mock-server/dual-topology-host/test/scenarios/fault-injection.spec.ts`

---

## Task 1: Scaffold host package and lock host-only boundary

**Files:**

- Create: `0-mock-server/dual-topology-host/*`
- Modify: `0-mock-server/dual-topology-host/package.json`
- Modify: `0-mock-server/dual-topology-host/src/types/host.ts`
- Modify: `0-mock-server/dual-topology-host/src/types/session.ts`
- Modify: `0-mock-server/dual-topology-host/src/types/fault.ts`

- [ ] Use the workspace scaffolder to create `0-mock-server/dual-topology-host`.
- [ ] Keep the host package focused on:
  - pairing
  - session
  - relay
  - observability
  - fault injection
- [ ] Define explicit host-side contracts for:
  - pairing ticket issuance / validation
  - hello / ack processing
  - host session lifecycle
  - ordered relay queueing
  - fault injection configuration

**Acceptance:**

- Host public contracts do not contain owner-ledger or business-completion logic.
- Package structure follows the mock-server host profile consistently.

---

## Task 2: Implement pairing and hello/ack compatibility flow

**Files:**

- Create: `0-mock-server/dual-topology-host/src/foundations/pairingRegistry.ts`
- Create: `0-mock-server/dual-topology-host/src/foundations/sessionRegistry.ts`
- Modify: `0-mock-server/dual-topology-host/src/types/host.ts`
- Modify: `0-mock-server/dual-topology-host/src/types/session.ts`

- [ ] Implement pairing ticket issuance, expiration, lookup, and occupancy checks.
- [ ] Implement hello validation against:
  - token validity
  - token expiration
  - role conflict
  - protocol compatibility
  - capability requirements
  - pair occupancy
- [ ] Produce explicit `NodeHelloAck` decisions instead of “connection succeeded therefore usable”.
- [ ] Ensure all stored time fields use millisecond numbers only.

**Acceptance:**

- Host can reject incompatible hello requests with explicit rejection codes.
- Compatibility and occupancy are visible host-side facts, not side effects.

---

## Task 3: Implement ordered relay and host observability

**Files:**

- Create: `0-mock-server/dual-topology-host/src/foundations/relayRouter.ts`
- Create: `0-mock-server/dual-topology-host/src/foundations/observability.ts`
- Modify: `0-mock-server/dual-topology-host/src/foundations/createDualTopologyHost.ts`
- Modify: `0-mock-server/dual-topology-host/src/types/host.ts`

- [ ] Implement relay channels for:
  - `CommandDispatchEnvelope`
  - `CommandEventEnvelope`
  - `ProjectionMirrorEnvelope`
- [ ] Keep relay ordering explicit per session/channel instead of raw best-effort pass-through.
- [ ] Record host observation events for:
  - ticket issuance
  - hello / ack
  - relay start / success / drop
  - disconnect / reconnect window
- [ ] Expose queryable host snapshots for sessions, pair states, and relay counters.

**Acceptance:**

- Host relay is protocolized, not just “forward any message”.
- Observation is structured enough to support later debugging and host-side test assertions.

---

## Task 4: Implement fault injection controls

**Files:**

- Create: `0-mock-server/dual-topology-host/src/foundations/faultInjection.ts`
- Modify: `0-mock-server/dual-topology-host/src/types/fault.ts`
- Modify: `0-mock-server/dual-topology-host/src/foundations/createDualTopologyHost.ts`

- [ ] Implement host-controlled fault injection for:
  - delayed ack
  - dropped relay
  - forced disconnect
  - temporary session rejection
- [ ] Scope fault injection to host/dev behavior only.
- [ ] Keep every injected fault explicitly observable in host state and logs.

**Acceptance:**

- Host can simulate the failure cases needed by later topology-runtime verification.
- Faults remain explicit host features, not hidden hacks inside relay logic.

---

## Task 5: Build formal test coverage and update progress docs

**Files:**

- Modify: `0-mock-server/dual-topology-host/test/index.ts`
- Modify: `0-mock-server/dual-topology-host/test/scenarios/pairing-and-hello.spec.ts`
- Modify: `0-mock-server/dual-topology-host/test/scenarios/relay-ordering.spec.ts`
- Modify: `0-mock-server/dual-topology-host/test/scenarios/fault-injection.spec.ts`
- Modify: `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md`

- [ ] Build formal `test/` coverage for:
  - pairing ticket lifecycle
  - hello/ack acceptance and rejection
  - relay ordering
  - fault injection behavior
- [ ] Run:
  - `corepack yarn type-check` in `0-mock-server/dual-topology-host`
  - `corepack yarn test` in `0-mock-server/dual-topology-host`
  - `corepack yarn test:scenario` in `0-mock-server/dual-topology-host`
- [ ] Update the progress doc so `dual-topology-host` becomes the next completed first-pass milestone.

**Acceptance:**

- Host package passes package-local verification.
- Progress docs match the actual repository state.
