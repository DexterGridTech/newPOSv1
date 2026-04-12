# Kernel Base V2 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first v2 kernel base runtime set around the unified `Command / Actor / RequestLedger` model.

**Architecture:** Phase 1 starts with `runtime-shell-v2` because every other v2 package depends on its command execution semantics. Then `tcp-control-runtime-v2`, `tdp-sync-runtime-v2`, and `workflow-runtime-v2` are migrated as normal modules that expose commands, declare actors, and verify behavior through command results plus request query.

**Tech Stack:** TypeScript 5, Yarn workspaces, Vitest, Redux Toolkit via `state-runtime`, RxJS for workflow observations, existing `transport-runtime` and `mock-terminal-platform` for live tests.

---

## File Map

Create:

1. `1-kernel/1.1-base/runtime-shell-v2`
2. `1-kernel/1.1-base/tcp-control-runtime-v2`
3. `1-kernel/1.1-base/tdp-sync-runtime-v2`
4. `1-kernel/1.1-base/workflow-runtime-v2`

Primary design references:

1. `refactor-doc/2026-04-12-kernel-base-runtime-shell-v2-design.md`
2. `refactor-doc/2026-04-12-kernel-base-tcp-control-runtime-v2-design.md`
3. `refactor-doc/2026-04-12-kernel-base-tdp-sync-runtime-v2-design.md`
4. `refactor-doc/2026-04-12-kernel-base-workflow-runtime-v2-design.md`

## Task 1: Scaffold Runtime Shell V2

**Files:**

1. Create: `1-kernel/1.1-base/runtime-shell-v2/package.json`
2. Create: `1-kernel/1.1-base/runtime-shell-v2/tsconfig.json`
3. Create: `1-kernel/1.1-base/runtime-shell-v2/src/**`
4. Create: `1-kernel/1.1-base/runtime-shell-v2/test/**`

Steps:

1. Scaffold package structure using the repository package scaffolder.
2. Replace generic exports with disciplined public exports.
3. Add `vitest.config.ts` and `test/tsconfig.json`.
4. Verify `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check` can discover the package.

Acceptance:

1. No React dependency.
2. No `features/middlewares` or `features/epics`.
3. `moduleName` is `kernel.base.runtime-shell-v2`.

## Task 2: Implement Runtime Shell V2 Core Model

**Files:**

1. Create: `src/types/command.ts`
2. Create: `src/types/actor.ts`
3. Create: `src/types/request.ts`
4. Create: `src/types/runtime.ts`
5. Create: `src/foundations/command.ts`
6. Create: `src/foundations/requestLedger.ts`
7. Create: `src/foundations/createKernelRuntimeV2.ts`

Steps:

1. Define `CommandDefinition`, `CommandIntent`, `DispatchedCommand`, `ActorDefinition`, `CommandAggregateResult`, `RequestQueryResult`.
2. Implement `defineCommand` with default `visibility / timeoutMs / allowNoActor / allowReentry / defaultTarget`.
3. Implement actor registration indexed by `commandName -> actor handlers`.
4. Implement `RequestLedger` as in-memory truth source.
5. Implement `runtime.dispatch(...)` and context `dispatch(...)`.

Acceptance:

1. Actor lookup is by commandName index, not full actor scan.
2. `dispatchChild` does not exist.
3. `sessionId` is not part of node-local execution model.

## Task 3: Runtime Shell V2 Behavior Tests

**Files:**

1. Create: `test/scenarios/runtime-shell-v2.spec.ts`

Scenarios:

1. One command is handled by two actors and returns stable `CommandAggregateResult`.
2. No actor with `allowNoActor = false` fails.
3. No actor with `allowNoActor = true` completes.
4. Actor dispatches child command and both commands are in the same request.
5. `CommandA -> Actor1 -> CommandB -> Actor1` is allowed.
6. Same actor/same command re-entry is rejected by default.
7. `allowReentry = true` allows explicit re-entry.
8. Timeout returns `TIMEOUT`.
9. Request is queryable before actor body executes.
10. `peer` target fails when peer gateway is not installed.

Acceptance:

1. Tests use command entry only.
2. Main assertions use aggregate result and request query.

## Task 4: Scaffold and Migrate TCP Control Runtime V2

Files:

1. Create: `1-kernel/1.1-base/tcp-control-runtime-v2/**`

Steps:

1. Scaffold package.
2. Port state slices from current `tcp-control-runtime`.
3. Port selectors.
4. Rebuild command definitions using `runtime-shell-v2`.
5. Rebuild actors around bootstrap, activation, credential refresh, task report, and state mutation.
6. Reuse existing HTTP service shape and `mock-terminal-platform` live harness.

Acceptance:

1. Tests enter through command dispatch.
2. Restart recovery verifies persisted identity/credential/binding and non-persisted runtime state.

## Task 5: Scaffold and Migrate TDP Sync Runtime V2

Files:

1. Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/**`

Steps:

1. Scaffold package.
2. Port session/sync/projection/command inbox/control signal state.
3. Keep projection repository persisted by projectionId.
4. Publish resolved topic changes as `tdpTopicDataChanged` command.
5. Bridge `error.message / system.parameter` to `runtime-shell-v2` catalog commands.
6. Preserve production infinite reconnect and test-limited reconnect.

Acceptance:

1. Scope priority is `Platform < Project < Brand < Tenant < Store < Terminal`.
2. High-priority delete falls back to lower-priority value.
3. Tests use `mock-terminal-platform`.

## Task 6: Scaffold and Migrate Workflow Runtime V2

Files:

1. Create: `1-kernel/1.1-base/workflow-runtime-v2/**`

Steps:

1. Scaffold package.
2. Port workflow definitions/observations/queue state.
3. Keep `run$()` observable-first.
4. Implement global serial queue.
5. Handle `tdpTopicDataChanged` command for remote definitions.
6. Keep script execution via `platform-ports.scriptExecutor`.

Acceptance:

1. `run$()` and selector/query return同构 `WorkflowObservation`.
2. Remote definitions add/update/delete are verified with TDP live tests.

## Task 7: Phase 1 Verification

Commands:

1. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 type-check`
2. `corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test`
3. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 type-check`
4. `corepack yarn workspace @impos2/kernel-base-tcp-control-runtime-v2 test`
5. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 type-check`
6. `corepack yarn workspace @impos2/kernel-base-tdp-sync-runtime-v2 test`
7. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 type-check`
8. `corepack yarn workspace @impos2/kernel-base-workflow-runtime-v2 test`

Acceptance:

1. Phase 1 packages compile independently.
2. Unit tests pass.
3. Live tests are documented if skipped due to server availability.
