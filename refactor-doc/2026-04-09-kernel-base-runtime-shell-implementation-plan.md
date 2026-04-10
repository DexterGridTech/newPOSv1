# Kernel Base Runtime Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `runtime-shell` so the new architecture has one explicit runtime assembly入口, one runtime-scoped execute API, and one formal request projection read model.

**Architecture:** `runtime-shell` will assemble `definition-registry + platform-ports + execution-runtime + topology-runtime` into one runtime instance. This phase implements three startup stages, runtime-scoped module installation, request projection read model, error/parameter catalog read model, and runtime-owned `CommandId` generation. It explicitly excludes `transport-runtime` and real persistence wiring.

**Tech Stack:** TypeScript 5, Yarn workspace package, `@impos2/kernel-base-contracts`, `@impos2/kernel-base-definition-registry`, `@impos2/kernel-base-platform-ports`, `@impos2/kernel-base-execution-runtime`, `@impos2/kernel-base-topology-runtime`, package-local `tsx` dev verification

---

## File Map

### `1-kernel/1.1-base/contracts`

**Modify:**

- `1-kernel/1.1-base/contracts/src/types/ids.ts`
- `1-kernel/1.1-base/contracts/src/foundations/runtimeId.ts`

### `1-kernel/1.1-base/runtime-shell`

**Create:**

- `1-kernel/1.1-base/runtime-shell/package.json`
- `1-kernel/1.1-base/runtime-shell/tsconfig.json`
- `1-kernel/1.1-base/runtime-shell/src/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/moduleName.ts`
- `1-kernel/1.1-base/runtime-shell/src/generated/packageVersion.ts`
- `1-kernel/1.1-base/runtime-shell/src/application/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/features/commands/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/features/actors/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/features/slices/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts`
- `1-kernel/1.1-base/runtime-shell/src/foundations/moduleResolver.ts`
- `1-kernel/1.1-base/runtime-shell/src/foundations/readModel.ts`
- `1-kernel/1.1-base/runtime-shell/src/foundations/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/selectors/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/hooks/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/supports/index.ts`
- `1-kernel/1.1-base/runtime-shell/src/types/runtime.ts`
- `1-kernel/1.1-base/runtime-shell/src/types/module.ts`
- `1-kernel/1.1-base/runtime-shell/src/types/state.ts`
- `1-kernel/1.1-base/runtime-shell/src/types/index.ts`
- `1-kernel/1.1-base/runtime-shell/test/index.ts`

---

## Task 1: Extend runtime ID language for runtime instances

**Files:**

- Modify: `1-kernel/1.1-base/contracts/src/types/ids.ts`
- Modify: `1-kernel/1.1-base/contracts/src/foundations/runtimeId.ts`

- [ ] Add `RuntimeInstanceId` and `runtime` kind to the unified runtime ID contract.
- [ ] Export `createRuntimeInstanceId()` from contracts.
- [ ] Keep the helper scoped to product runtime layers only, consistent with the existing ID rule.

**Acceptance:**

- `contracts` still passes type-check.
- `runtime-shell` can use a formal runtime instance ID instead of inventing local string IDs.

---

## Task 2: Scaffold `runtime-shell` and define public contracts

**Files:**

- Create: `1-kernel/1.1-base/runtime-shell/*`
- Modify: `1-kernel/1.1-base/runtime-shell/package.json`
- Modify: `1-kernel/1.1-base/runtime-shell/src/types/module.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/types/runtime.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/types/state.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/dev/index.ts`

- [ ] Use the workspace scaffolder to create the package skeleton under `1-kernel/1.1-base/runtime-shell`.
- [ ] Remove premature `transport-runtime` dependency from the generated `package.json` for this first phase.
- [ ] Define `KernelRuntimeModule`, `KernelRuntime`, startup seed types, read model state types, and runtime execute input types.
- [ ] Replace placeholder `dev/index.ts` with a scenario that verifies:
  - root request execution goes through runtime
  - request projection is readable from runtime state
  - error/parameter catalogs are readable
  - startup hooks run in the expected phase order

**Acceptance:**

- `runtime-shell` exposes one public runtime API surface, not multiple manager-like entry points.
- `hooks/index.ts` remains a rule-marker file only.

---

## Task 3: Implement module resolution and runtime read model

**Files:**

- Create: `1-kernel/1.1-base/runtime-shell/src/foundations/moduleResolver.ts`
- Create: `1-kernel/1.1-base/runtime-shell/src/foundations/readModel.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/types/module.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/types/state.ts`

- [ ] Implement runtime module dependency flattening with dependency-first ordering and cycle rejection.
- [ ] Define in-memory runtime read model state with:
  - `requestProjections`
  - `errorCatalog`
  - `parameterCatalog`
- [ ] Provide selectors for:
  - full runtime state snapshot
  - request projection by `RequestId`
  - error catalog entry by key
  - parameter catalog entry by key

**Acceptance:**

- `runtime-shell` read model stays clearly separate from owner truth.
- request projection is a selector-driven read model, not the execution truth source.

---

## Task 4: Implement `createKernelRuntime(...)`

**Files:**

- Create: `1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/index.ts`

- [ ] Assemble one runtime instance with:
  - `platformPorts`
  - `definitionRegistryBundle`
  - `executionRuntime`
  - `topologyRuntime`
  - in-memory read model state
- [ ] Implement three startup stages:
  - `startup-seed`
  - `host-bootstrap`
  - `post-start-initialize`
- [ ] Register module-provided error/parameter definitions into the shared registries.
- [ ] Register module-provided execution handlers.
- [ ] Execute declared initialize commands through the internal command lane, not by calling handlers directly.
- [ ] Provide `runtime.execute(...)` that generates `CommandId` inside runtime, registers root/child topology nodes, and keeps request projection state synchronized.
- [ ] Ensure request `started` state is still synchronized before handler body by relying on `execution-runtime` lifecycle start event.

**Acceptance:**

- `runtime-shell` is the only assembly entry point for the first phase.
- `CommandId` ownership is moved to runtime-shell.
- request projection stays readable even though owner truth lives in topology-runtime.

---

## Task 5: Verify and update progress docs

**Files:**

- Modify: `1-kernel/1.1-base/runtime-shell/dev/index.ts`
- Modify: `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md`

- [ ] Run:
  - `corepack yarn workspace @impos2/kernel-base-runtime-shell type-check`
  - `corepack yarn workspace @impos2/kernel-base-runtime-shell dev`
- [ ] If contracts changed for runtime IDs, re-run:
  - `corepack yarn workspace @impos2/kernel-base-contracts type-check`
  - `corepack yarn workspace @impos2/kernel-base-contracts dev`
- [ ] Update the progress summary doc so `runtime-shell` no longer appears as “not started”.

**Acceptance:**

- `runtime-shell` passes `type-check` and `dev`.
- the progress document reflects the real repository state.
