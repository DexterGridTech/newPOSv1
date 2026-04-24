# Topology Runtime V3 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining topology-runtime-v3 business gaps so admin-console, terminal activation, assembly host lifecycle, and verification agree on the same V3 rules.

**Architecture:** Keep topology-runtime-v3 as the shared rule owner for topology eligibility decisions, while assembly remains the owner of native host lifecycle and storage gating. UI packages consume shared selectors/reason codes and only render or dispatch allowed actions. Tests prove each rule at the smallest package boundary first, then assembly integration.

**Tech Stack:** TypeScript, React Native, React Redux, Redux Toolkit, Vitest, Kotlin/Android topology host, `@next/kernel-base-topology-runtime-v3`, `@next/ui-base-admin-console`, `@next/ui-base-terminal-console`, `@next/assembly-android-mixc-retail-rn84`.

---

## File Map

- Modify: `1-kernel/1.1-base/topology-runtime-v3/src/types/state.ts`
- Modify: `1-kernel/1.1-base/topology-runtime-v3/src/types/runtime.ts`
- Modify: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/runtimeDerivation.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/eligibility.ts`
- Modify: `1-kernel/1.1-base/topology-runtime-v3/src/selectors/index.ts`
- Modify: `1-kernel/1.1-base/topology-runtime-v3/src/features/actors/contextActor.ts`
- Modify: `1-kernel/1.1-base/topology-runtime-v3/src/index.ts`
- Modify: `1-kernel/1.1-base/topology-runtime-v3/test/scenarios/topology-runtime-v3.spec.ts`
- Modify: `2-ui/2.1-base/terminal-console/package.json`
- Modify: `2-ui/2.1-base/terminal-console/src/hooks/useDeviceActivation.ts`
- Modify: `2-ui/2.1-base/terminal-console/src/types/terminal.ts`
- Modify: `2-ui/2.1-base/terminal-console/src/ui/screens/ActivateDeviceScreen.tsx`
- Modify: `2-ui/2.1-base/terminal-console/test/scenarios/terminal-console-rendered.spec.tsx`
- Modify: `2-ui/2.1-base/admin-console/src/types/admin.ts`
- Modify: `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`
- Modify: `2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyHostLifecycle.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-host-lifecycle.spec.ts`

---

## Task 1: Shared topology eligibility rules

- [ ] Add context `displayIndex/displayCount` metadata so eligibility can distinguish single-screen standalone slave from managed primary/secondary.
- [ ] Add pure helpers for TCP activation, switch-to-slave, enable-slave, and display-mode permissions with stable reason codes.
- [ ] Export selectors that combine topology context with an activation status argument.
- [ ] Guard topology context commands in runtime actors with the same helper rules.
- [ ] Add package tests for derivation, reason codes, and command guard failures.

## Task 2: Terminal activation UI uses shared rules

- [ ] Add topology-runtime-v3 dependency to terminal-console.
- [ ] Update `useDeviceActivation` to derive activation eligibility from topology context + TCP identity.
- [ ] Render disabled reason / already-activated state instead of always rendering a submit-capable form.
- [ ] Keep managed secondary screen behavior intact.
- [ ] Add rendered tests for slave, managed secondary, already activated, and master-unactivated cases.

## Task 3: Admin topology panel becomes constrained pair control

- [ ] Extend `AdminTopologyHost` to expose stop/status/diagnostics/share/import actions.
- [ ] Render role+activation, host service, pair control, display mode, and diagnostics sections.
- [ ] Disable actions with explicit reasons instead of allowing invalid topology commands.
- [ ] Wire share payload export, import JSON, host status, diagnostics, reconnect, stop, and clear locator.
- [ ] Add admin tests for disabled reasons and host action dispatch.

## Task 4: Assembly owns native host lifecycle

- [ ] Add assembly helper that decides whether native topology host should run from `displayCount + instanceMode + enableSlave`.
- [ ] Subscribe to runtime state in `createApp` and call `nativeTopologyHost.start/stop` only when desired state changes.
- [ ] Keep managed secondary persistence gate unchanged: disable only when `displayMode === SECONDARY && standalone === false`.
- [ ] Add assembly tests proving single-screen master enable/disable starts/stops, activated master can enable slave, slave stops host, and managed secondary is not manually started.

## Task 5: Validation and old-package gate

- [ ] Run targeted tests for topology-runtime-v3, terminal-console, admin-console, and assembly.
- [ ] Run type-checks for the touched packages.
- [ ] Re-run V2 import audit and list remaining blockers; do not delete V2 until emulator/real-device socket evidence is collected.
- [ ] Record verification evidence and remaining risks in the final handoff.

## 2026-04-19 Closure Addendum

Implementation review found three remaining gaps before the old V2 packages can be considered removable:

1. `AdminTopologyHost.stop()` must not pretend to own native host lifecycle directly. Native host lifecycle is derived by assembly from `instanceMode + displayCount + enableSlave`; the admin action should disable `enableSlave` for host shutdown intent, while `stopTopologyConnection` remains only a topology connection action.
2. Admin topology pairing needs a real JSON import path, not just re-importing the last generated in-memory payload. The first version will use a simple text field plus parse/validate/import button.
3. Assembly needs package-level lifecycle tests and structured lifecycle logs for `host-start`, `host-stop`, `host-skip`, and `host-error`; this is the minimum evidence path for later socket/device debugging.

### Task 4A: Admin host control semantics

- [ ] Add an import JSON text state to `AdminTopologySection`.
- [ ] Add a visible input or simple text entry surface for pasted share payload JSON.
- [ ] Add an `import-json` action that parses `AdminTopologySharePayload` and calls `topologyHost.importSharePayload`.
- [ ] Change assembly `AdminTopologyHost.stop()` to dispatch `setEnableSlave(false)` so the assembly lifecycle subscription performs the native stop.
- [ ] Add tests for JSON import and host stop intent.

### Task 4B: Assembly lifecycle evidence

- [ ] Mock `nativeTopologyHost` in `assembly-create-app.spec.ts` so `createApp` remains native-free under Vitest.
- [ ] Add pure lifecycle helper tests for single-screen master enable/disable, activated master, slave, and managed secondary.
- [ ] Add createApp lifecycle tests that start/stop native host only from subscribed topology context transitions.
- [ ] Add structured logs around host lifecycle decisions and failures.
