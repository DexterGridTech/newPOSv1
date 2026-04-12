# tcp-control-runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution for this repository unless the user asks to split into subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `1-kernel/1.1-base/tcp-control-runtime` as the new TCP control-plane base package that replaces old `1-kernel/1.1-cores/tcp-client`.

**Architecture:** The package owns terminal control-plane identity, credential, binding, and runtime observation state. It exposes commands and selectors as the only cross-package write/read contract, while slice actions remain package-internal. HTTP integration uses `transport-runtime`; state persistence uses `state-runtime` field-level persistence.

**Tech Stack:** TypeScript, Redux Toolkit, `kernel-base-runtime-shell`, `kernel-base-state-runtime`, `kernel-base-transport-runtime`, Vitest.

---

## File Structure

- `1-kernel/1.1-base/tcp-control-runtime/src/types/state.ts`
  Defines persisted and runtime-only state shapes.
- `1-kernel/1.1-base/tcp-control-runtime/src/types/api.ts`
  Defines control-plane HTTP request/response protocol.
- `1-kernel/1.1-base/tcp-control-runtime/src/types/runtime.ts`
  Defines module input and assembly-provided HTTP binding.
- `1-kernel/1.1-base/tcp-control-runtime/src/foundations/stateKeys.ts`
  Defines stable slice keys.
- `1-kernel/1.1-base/tcp-control-runtime/src/features/slices/*.ts`
  Implements one focused slice file per state responsibility.
- `1-kernel/1.1-base/tcp-control-runtime/src/features/commands/index.ts`
  Defines stable command names.
- `1-kernel/1.1-base/tcp-control-runtime/src/foundations/httpService.ts`
  Wraps `transport-runtime` endpoints and unwraps platform envelopes.
- `1-kernel/1.1-base/tcp-control-runtime/src/foundations/module.ts`
  Installs handlers into `runtime-shell`.
- `1-kernel/1.1-base/tcp-control-runtime/src/selectors/tcpControl.ts`
  Provides public read API for business modules.
- `1-kernel/1.1-base/tcp-control-runtime/src/supports/errors.ts`
  Defines error catalog entries.
- `1-kernel/1.1-base/tcp-control-runtime/src/supports/parameters.ts`
  Defines parameter catalog entries.
- `1-kernel/1.1-base/tcp-control-runtime/test/scenarios/tcp-control-runtime.spec.ts`
  Verifies activation, refresh, task report, and persistence semantics.

## Tasks

### Task 1: Package Skeleton

**Files:**
- Create: `1-kernel/1.1-base/tcp-control-runtime/package.json`
- Create: `1-kernel/1.1-base/tcp-control-runtime/src/moduleName.ts`
- Create: `1-kernel/1.1-base/tcp-control-runtime/src/hooks/index.ts`

- [x] Scaffold the package using `workspace-package-scaffolder`.
- [x] Keep `hooks/index.ts` as a non-React rule marker.
- [ ] Add required base package dependencies and Vitest scripts.

### Task 2: State And Selectors

**Files:**
- Create: `src/types/state.ts`
- Create: `src/foundations/stateKeys.ts`
- Create: `src/features/slices/tcpIdentity.ts`
- Create: `src/features/slices/tcpCredential.ts`
- Create: `src/features/slices/tcpBinding.ts`
- Create: `src/features/slices/tcpRuntime.ts`
- Modify: `src/features/slices/index.ts`
- Create: `src/selectors/tcpControl.ts`
- Modify: `src/selectors/index.ts`

- [ ] Implement `tcpIdentity`, `tcpCredential`, `tcpBinding` as `owner-only` persisted slices.
- [ ] Implement `tcpRuntime` as `persistIntent: 'never'`.
- [ ] Persist protected credential fields through `secureStateStorage`.
- [ ] Export selectors for identity, credential, binding, terminalId, accessToken, refreshToken, and activated status.

### Task 3: Commands And HTTP Service

**Files:**
- Create: `src/types/api.ts`
- Create: `src/types/runtime.ts`
- Modify: `src/features/commands/index.ts`
- Create: `src/foundations/httpService.ts`
- Modify: `src/foundations/index.ts`

- [ ] Define command names for bootstrap, activate, refresh, report, reset, and internal success events.
- [ ] Define HTTP endpoints for activation, refresh, and task result report.
- [ ] Unwrap `{success,data,error}` envelopes inside the service.
- [ ] Keep transport failures normalized through `transport-runtime`.

### Task 4: Runtime Module

**Files:**
- Create: `src/foundations/module.ts`
- Modify: `src/index.ts`

- [ ] Expose `createTcpControlRuntimeModule(input)`.
- [ ] Register state slices, commands, error definitions, and parameter definitions.
- [ ] Register handlers that synchronously write request/runtime state before async HTTP calls.
- [ ] Keep slice actions internal and expose only commands/selectors at package root.

### Task 5: Verification

**Files:**
- Create: `test/tsconfig.json`
- Create: `test/scenarios/tcp-control-runtime.spec.ts`
- Modify: `test/index.ts`

- [ ] Test activation writes identity, credential, and binding state.
- [ ] Test refresh updates access token and keeps refresh token.
- [ ] Test task result report uses local terminalId when caller omits it.
- [ ] Test persistence restores identity, binding, credential, and does not restore runtime-only fields.
- [ ] Prepare for real `mock-terminal-platform` integration by adding fetch-based transport helper.

## Self-Review

- Spec coverage: Covers old `tcp-client` duties, new base package boundaries, state persistence, commands, selectors, HTTP, errors, parameters, and tests.
- Placeholder scan: No implementation placeholder remains in this plan; open task checkboxes represent execution tracking.
- Type consistency: Uses the new package names `tcp-control-runtime`, `TcpControl*`, and state keys under `kernel.base.tcp-control-runtime.*`.
