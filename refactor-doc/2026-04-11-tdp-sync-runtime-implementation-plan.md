# tdp-sync-runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution for this repository unless the user asks to split into subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `1-kernel/1.1-base/tdp-sync-runtime` as the new TDP data-plane sync package replacing old `1-kernel/1.1-cores/tdp-client`.

**Architecture:** The package owns TDP session observation, minimal sync recovery state, raw projection cache, raw command inbox, and protocol control signals. It depends on `tcp-control-runtime` for `terminalId + accessToken`, reuses `transport-runtime` for HTTP/WS transport, and exposes only commands/selectors as public package contracts.

**Tech Stack:** TypeScript, Redux Toolkit, `kernel-base-runtime-shell`, `kernel-base-state-runtime`, `kernel-base-transport-runtime`, `kernel-base-tcp-control-runtime`, Vitest.

---

## File Structure

- `1-kernel/1.1-base/tdp-sync-runtime/src/types/state.ts`
  Defines `tdpSession`, `tdpSync`, `tdpProjection`, `tdpCommandInbox`, `tdpControlSignals`.
- `1-kernel/1.1-base/tdp-sync-runtime/src/types/protocol.ts`
  Defines TDP client/server message protocol and HTTP envelopes.
- `1-kernel/1.1-base/tdp-sync-runtime/src/types/runtime.ts`
  Defines module input plus assembly-provided HTTP/WS bindings.
- `1-kernel/1.1-base/tdp-sync-runtime/src/foundations/stateKeys.ts`
  Defines stable slice keys.
- `1-kernel/1.1-base/tdp-sync-runtime/src/features/slices/*.ts`
  Implements one focused slice file per state responsibility.
- `1-kernel/1.1-base/tdp-sync-runtime/src/features/commands/index.ts`
  Defines stable TDP command names.
- `1-kernel/1.1-base/tdp-sync-runtime/src/selectors/tdpSync.ts`
  Provides public read-model selectors.
- `1-kernel/1.1-base/tdp-sync-runtime/src/foundations/httpService.ts`
  Wraps snapshot / changes HTTP endpoints.
- `1-kernel/1.1-base/tdp-sync-runtime/src/foundations/socketBinding.ts`
  Defines reusable socket profile and a thin runtime binding contract.
- `1-kernel/1.1-base/tdp-sync-runtime/src/foundations/messageReducer.ts`
  Maps protocol messages to state actions and internal commands.
- `1-kernel/1.1-base/tdp-sync-runtime/src/foundations/module.ts`
  Installs handlers into `runtime-shell`.
- `1-kernel/1.1-base/tdp-sync-runtime/test/scenarios/tdp-sync-runtime.spec.ts`
  Verifies message handling, sync cursor persistence, and bootstrap/rehydrate semantics.

## Tasks

### Task 1: Package Skeleton

**Files:**
- Create: `1-kernel/1.1-base/tdp-sync-runtime/package.json`
- Create: `1-kernel/1.1-base/tdp-sync-runtime/src/moduleName.ts`
- Create: `1-kernel/1.1-base/tdp-sync-runtime/src/hooks/index.ts`

- [ ] Scaffold the package using `workspace-package-scaffolder`.
- [ ] Add base package dependencies and Vitest scripts.
- [ ] Keep `hooks/index.ts` as a non-React rule marker.

### Task 2: State And Selectors

**Files:**
- Create: `src/types/state.ts`
- Create: `src/foundations/stateKeys.ts`
- Create: `src/features/slices/tdpSession.ts`
- Create: `src/features/slices/tdpSync.ts`
- Create: `src/features/slices/tdpProjection.ts`
- Create: `src/features/slices/tdpCommandInbox.ts`
- Create: `src/features/slices/tdpControlSignals.ts`
- Modify: `src/features/slices/index.ts`
- Create: `src/selectors/tdpSync.ts`
- Modify: `src/selectors/index.ts`

- [ ] Persist only `tdpSync.lastCursor` and `tdpSync.lastAppliedCursor`.
- [ ] Keep `tdpSession`, `tdpProjection`, `tdpCommandInbox`, `tdpControlSignals` runtime-only.
- [ ] Preserve old package semantics for session state, projection cache, command inbox, and control signals.

### Task 3: Protocol And Commands

**Files:**
- Create: `src/types/protocol.ts`
- Modify: `src/features/commands/index.ts`
- Create: `src/supports/errors.ts`
- Create: `src/supports/parameters.ts`
- Modify: `src/supports/index.ts`

- [ ] Define stable protocol message types.
- [ ] Define public commands: `connectTdpSession`, `disconnectTdpSession`.
- [ ] Define semi-public commands: `acknowledgeCursor`, `reportAppliedCursor`, `sendPing`.
- [ ] Define internal bridge commands for socket/runtime/protocol events.

### Task 4: Transport And Module

**Files:**
- Create: `src/types/runtime.ts`
- Create: `src/foundations/httpService.ts`
- Create: `src/foundations/socketBinding.ts`
- Create: `src/foundations/messageReducer.ts`
- Create: `src/foundations/module.ts`
- Modify: `src/foundations/index.ts`
- Modify: `src/index.ts`

- [ ] Reuse `transport-runtime` HTTP endpoint and socket profile helpers.
- [ ] Read `terminalId + accessToken` via `tcp-control-runtime` selectors.
- [ ] Support assembly-provided socket binding and HTTP runtime injection.
- [ ] Implement first-round handlers for bootstrap, session-ready, full snapshot, changes, projection push, command delivered, pong, degraded, rehome, protocol error, ack, and state-report.
- [ ] Keep reconnect strategy minimal in the first round; expose extension points instead of hardcoding a full orchestrator.

### Task 5: Verification

**Files:**
- Create: `test/tsconfig.json`
- Create: `test/scenarios/tdp-sync-runtime.spec.ts`
- Modify: `test/index.ts`

- [ ] Verify `tdpSession`, `tdpProjection`, `tdpCommandInbox`, `tdpControlSignals` state transitions from protocol messages.
- [ ] Verify `tdpSync.lastCursor` and `lastAppliedCursor` persist and restore.
- [ ] Verify runtime-only fields do not restore after restart.
- [ ] Verify `connectTdpSession` precheck fails when TCP identity/credential is missing.
- [ ] Leave real `mock-terminal-platform` WS end-to-end verification as a follow-up once the package module contract is stable.

## Self-Review

- Spec coverage: Covers old `tdp-client` duties, new base package boundaries, minimal persistence, protocol message mapping, command surface, and tests.
- Placeholder scan: No implementation placeholder remains in this plan; open task checkboxes represent execution tracking.
- Type consistency: Uses the new package names `tdp-sync-runtime`, `TdpSync*`, and state keys under `kernel.base.tdp-sync-runtime.*`.
