# Topology Runtime V3 Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `dual-topology-host-v3` and `topology-runtime-v3`, migrate all assembly/UI/kernel integration and tests onto them, verify RN84 on emulator and real device through the automation socket, then delete `0-mock-server/dual-topology-host` and `1-kernel/1.1-base/topology-runtime-v2`.

**Architecture:** Execute the replacement in strict phases. First create V3 host and V3 topology runtime in parallel with V2, preserving the existing product behavior while establishing no-ticket pair semantics. Next migrate adapter, assembly, UI, Expo/test helpers, and kernel live harnesses to V3. Only after all package tests, assembly automation tests, and real-device socket-driven verification pass do we remove V2 imports, delete the old packages, and update docs/memory.

**Tech Stack:** TypeScript, Vitest, Kotlin, Android Service/WS host, React Native 0.84, Expo Web test helpers, `@impos2/kernel-base-state-runtime`, `@impos2/kernel-base-runtime-shell-v2`, `@impos2/kernel-base-tdp-sync-runtime-v2`, `@impos2/ui-base-admin-console`, `@impos2/ui-base-terminal-console`, `scripts/android-automation-rpc.mjs`, ADB automation socket.

**Execution Note:** Steps that show `git commit` are delivery checkpoints for a later execution pass. Do not create commits during implementation unless the user explicitly asks for them in that execution session.

---

## File Map

### New V3 kernel and mock-host packages

- Create: `0-mock-server/dual-topology-host-v3/package.json`
- Create: `0-mock-server/dual-topology-host-v3/src/index.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/moduleName.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/runtime/**`
- Create: `0-mock-server/dual-topology-host-v3/src/types/**`
- Create: `0-mock-server/dual-topology-host-v3/src/supports/**`
- Create: `0-mock-server/dual-topology-host-v3/test/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/package.json`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/index.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/moduleName.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/application/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/selectors/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/supports/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/types/**`
- Create: `1-kernel/1.1-base/topology-runtime-v3/test/**`

### Adapter / assembly / UI migration points

- Modify: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhost/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/**`
- Modify: `3-adapter/android/adapter-android-v2/adapter-lib/src/test/**`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/bootstrapRuntime.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createModule.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/resolveTopologyLaunch.ts`
- Create or modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology-v3/**`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/startup/TopologyLaunchCoordinator.kt`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/TopologyHostTurboModule.kt`
- Modify: `2-ui/2.1-base/admin-console/src/types/admin.ts`
- Modify: `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`
- Modify: `2-ui/2.1-base/terminal-console/src/ui/screens/ActivateDeviceScreen.tsx`
- Modify: `2-ui/2.1-base/terminal-console/src/hooks/useDeviceActivation.ts`
- Modify: `2-ui/2.1-base/runtime-react/test-expo/**`

### Old-package removal targets

- Delete after migration: `0-mock-server/dual-topology-host/**`
- Delete after migration: `1-kernel/1.1-base/topology-runtime-v2/**`
- Modify after migration: all remaining imports of `@impos2/kernel-base-topology-runtime-v2`
- Modify after migration: all remaining imports/usages of `dual-topology-host`
- Modify after migration: docs and READMEs that still describe V2 / old host

---
## Release Gates

Old packages can be deleted only after all of the following are true:

- [ ] `0-mock-server/dual-topology-host-v3` package tests pass.
- [ ] `1-kernel/1.1-base/topology-runtime-v3` package tests pass.
- [ ] Android adapter host-v3 unit tests pass.
- [ ] `4-assembly/android/mixc-retail-assembly-rn84` Vitest suite passes after migration.
- [ ] `2-ui/2.1-base/admin-console` and `2-ui/2.1-base/terminal-console` tests pass after migration.
- [ ] Expo / browser topology helpers are migrated and pass against V3 host.
- [ ] No remaining repo imports of `@impos2/kernel-base-topology-runtime-v2` except temporary migration shims explicitly listed in the plan.
- [ ] No remaining repo imports/usages of `@impos2/dual-topology-host` except temporary migration shims explicitly listed in the plan.
- [ ] RN84 emulator flow passes: master/slave pair, activation restriction, admin topology panel, reconnect, state sync.
- [ ] RN84 real-device flow passes on `4-assembly/android/mixc-retail-assembly-rn84`.
- [ ] Real-device verification includes direct socket RPC evidence through `scripts/android-automation-rpc.mjs`, not only UI scripting.
- [ ] Real-device verification explicitly proves data sync on both screens/targets by reading runtime state and UI node values before and after changes.
- [ ] After all of the above, delete `0-mock-server/dual-topology-host` and `1-kernel/1.1-base/topology-runtime-v2`, rerun the affected suites, and confirm green again.

### Task 1: Build `dual-topology-host-v3` as the no-ticket pair-host baseline

**Files:**
- Create: `0-mock-server/dual-topology-host-v3/package.json`
- Create: `0-mock-server/dual-topology-host-v3/tsconfig.json`
- Create: `0-mock-server/dual-topology-host-v3/vitest.config.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/index.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/moduleName.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/runtime/createDualTopologyHostV3.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/runtime/createDualTopologyHostV3Server.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/runtime/runtimeDeps.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/types/hostShell.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/types/server.ts`
- Create: `0-mock-server/dual-topology-host-v3/src/supports/parameters.ts`
- Create: `0-mock-server/dual-topology-host-v3/test/index.ts`
- Create: `0-mock-server/dual-topology-host-v3/test/scenarios/http-server.spec.ts`
- Create: `0-mock-server/dual-topology-host-v3/test/scenarios/ws-server.spec.ts`
- Create: `0-mock-server/dual-topology-host-v3/test/helpers/runtimeV3Harness.ts`

- [ ] **Step 1: Write the failing package smoke test**

Create `0-mock-server/dual-topology-host-v3/test/scenarios/http-server.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createDualTopologyHostV3Server} from '../../src'

describe('dual-topology-host-v3 http server', () => {
    it('exposes status and stats endpoints', async () => {
        const server = createDualTopologyHostV3Server()
        await server.start()
        const status = await fetch(`${server.getAddressInfo().httpBaseUrl}/status`).then(r => r.json())
        const stats = await fetch(`${server.getAddressInfo().httpBaseUrl}/stats`).then(r => r.json())
        expect(status.state).toBeDefined()
        expect(stats.sessionCount).toBe(0)
        await server.close()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack yarn vitest run 0-mock-server/dual-topology-host-v3/test/scenarios/http-server.spec.ts`

Expected: FAIL with missing workspace/files.

- [ ] **Step 3: Scaffold the package shell from the current mock host shape**

Copy the package structure from `0-mock-server/dual-topology-host`, but change names to V3:

- package name: `@impos2/dual-topology-host-v3`
- module name: `mock.server.dual-topology-host-v3`
- no dependency on ticket issuance in public server APIs

The exported root in `0-mock-server/dual-topology-host-v3/src/index.ts` must expose:

```ts
export {moduleName} from './moduleName'
export {createDualTopologyHostV3} from './runtime/createDualTopologyHostV3'
export {createDualTopologyHostV3Server} from './runtime/createDualTopologyHostV3Server'
export type * from './types/hostShell'
export type * from './types/server'
```

- [ ] **Step 4: Implement the minimal HTTP shell to satisfy the first test**

Implement a server with:

- `GET /status`
- `GET /stats`
- dynamic port resolution
- `getAddressInfo()` returning `host / port / basePath / httpBaseUrl / wsUrl`

Do not add ticket endpoints.

- [ ] **Step 5: Add the failing WebSocket pair-flow test**

Create `0-mock-server/dual-topology-host-v3/test/scenarios/ws-server.spec.ts` with a first real flow:

```ts
import {describe, expect, it} from 'vitest'
import WebSocket from 'ws'
import {createDualTopologyHostV3Server} from '../../src'

describe('dual-topology-host-v3 ws server', () => {
    it('accepts one master and one slave over hello/hello-ack', async () => {
        const server = createDualTopologyHostV3Server()
        await server.start()
        const {wsUrl} = server.getAddressInfo()
        const master = new WebSocket(wsUrl)
        const slave = new WebSocket(wsUrl)
        // open sockets, send hello, assert one master + one slave accepted
        await server.close()
        master.close()
        slave.close()
    })
})
```

Expected initial result: FAIL because hello/ack routing does not exist yet.

- [ ] **Step 6: Implement pair-only V3 protocol shell**

Implement only these messages in the first pass:

- `hello`
- `hello-ack`
- `state-snapshot`
- `state-update`
- `command-dispatch`
- `command-event`
- `request-snapshot`

Host invariants:

- exactly one connected `MASTER`
- exactly one connected `SLAVE`
- reject duplicate role occupancy
- on reconnect, a fresh `hello` creates or rebinds the session
- do not cache offline relay messages; reconnect recovery is `hello -> authoritative snapshot`

- [ ] **Step 7: Add fault-rule coverage before broadening consumers**

Add tests for:

- delayed relay
- dropped relay
- forced disconnect
- role-occupancy reject
- offline relay is discarded rather than replayed after reconnect

Run: `corepack yarn vitest run 0-mock-server/dual-topology-host-v3/test/index.ts`

Expected: PASS.

- [ ] **Step 8: Commit the standalone host-v3 baseline**

```bash
git add 0-mock-server/dual-topology-host-v3
git commit -m "Build V3 pair host baseline"
```

### Task 2: Build `topology-runtime-v3` on top of existing `state-runtime` sync primitives

**Files:**
- Create: `1-kernel/1.1-base/topology-runtime-v3/package.json`
- Create: `1-kernel/1.1-base/topology-runtime-v3/tsconfig.json`
- Create: `1-kernel/1.1-base/topology-runtime-v3/vitest.config.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/index.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/moduleName.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/application/createModule.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/application/moduleManifest.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/commands/index.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/actors/configActor.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/actors/connectionActor.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/actors/initializeActor.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/slices/configState.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/slices/runtimeState.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/slices/peerState.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/features/slices/requestMirrorState.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/runtimeDerivation.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/pairLinkController.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/syncRegistry.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/foundations/protocol.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/src/selectors/index.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/test/index.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/test/scenarios/topology-runtime-v3.spec.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/test/scenarios/topology-runtime-v3-live-connection.spec.ts`
- Create: `1-kernel/1.1-base/topology-runtime-v3/test/helpers/liveHarness.ts`

- [ ] **Step 1: Write the failing context derivation tests**

Create `1-kernel/1.1-base/topology-runtime-v3/test/scenarios/topology-runtime-v3.spec.ts` with the first expectations:

```ts
import {describe, expect, it} from 'vitest'
import {deriveTopologyV3RuntimeContext} from '../../src/foundations/runtimeDerivation'

describe('topology-runtime-v3 context derivation', () => {
    it('derives standalone slave from displayIndex instead of instanceMode fallback', () => {
        const context = deriveTopologyV3RuntimeContext({
            displayIndex: 0,
            displayCount: 1,
            configState: {
                instanceMode: 'SLAVE',
                enableSlave: false,
                masterLocator: {serverAddress: [{address: 'ws://127.0.0.1:18888/ws'}], addedAt: Date.now()},
            },
        })
        expect(context.standalone).toBe(true)
        expect(context.displayMode).toBe('PRIMARY')
        expect(context.workspace).toBe('BRANCH')
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack yarn vitest run 1-kernel/1.1-base/topology-runtime-v3/test/scenarios/topology-runtime-v3.spec.ts`

Expected: FAIL with missing package/files.

- [ ] **Step 3: Scaffold the package using V2 shape, but delete resume/ticket semantics up front**

The first package shell must:

- mirror V2 public ergonomics where useful
- expose V3 selectors and commands
- omit `resumeTopologySession`
- omit ticket-bearing public types

Initial commands should be:

```ts
setInstanceMode
setDisplayMode
setEnableSlave
setMasterLocator
clearMasterLocator
refreshTopologyContext
startTopologyConnection
stopTopologyConnection
restartTopologyConnection
dispatchPeerCommand
```

- [ ] **Step 4: Implement runtime derivation and display-context guard first**

Implement `deriveTopologyV3RuntimeContext` so that:

- `displayIndex` and `displayCount` are required for assembly-driven startup
- `displayIndex===0` determines `standalone=true`
- `displayIndex>0` determines `standalone=false`
- missing display context throws or returns an explicit startup error in assembly-facing paths
- `workspace` uses `SLAVE + PRIMARY => BRANCH`, otherwise `MAIN`

- [ ] **Step 5: Add failing live connection test against host-v3**

Create `1-kernel/1.1-base/topology-runtime-v3/test/scenarios/topology-runtime-v3-live-connection.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createTopologyRuntimeV3LiveHarness} from '../helpers/liveHarness'

describe('topology-runtime-v3 live connection', () => {
    it('connects master and slave through dual-topology-host-v3 without tickets', async () => {
        const harness = await createTopologyRuntimeV3LiveHarness()
        await harness.start()
        expect(harness.master.getConnectionStatus()).toBe('ACTIVE')
        expect(harness.slave.getConnectionStatus()).toBe('ACTIVE')
        await harness.close()
    })
})
```

Expected initial result: FAIL because no live harness or pair controller exists yet.

- [ ] **Step 6: Implement pair controller and sync registry on top of current `syncIntent` / `slice.sync`**

Implementation rules:

- keep `StateRuntimeSliceDescriptor.syncIntent`
- map `master-to-slave` to authority `MASTER`
- map `slave-to-master` to authority `SLAVE`
- keep `isolated` slices out of pair sync
- force the first post-hello snapshot to apply even if revision matches previous values
- rely on WS ordered delivery, do not add app-layer ack/seq/resend in V1

- [ ] **Step 7: Add request mirror, command relay, and peer-state tests**

Add tests that prove:

- peer info is runtime-only and not persisted
- command dispatch/event roundtrip works
- request mirror propagates snapshots
- reconnect causes `hello -> snapshot -> ACTIVE`
- offline peer relay is not queued or replayed; snapshot is the recovery mechanism

Run: `corepack yarn vitest run 1-kernel/1.1-base/topology-runtime-v3/test/index.ts`

Expected: PASS.

- [ ] **Step 8: Commit the kernel V3 runtime baseline**

```bash
git add 1-kernel/1.1-base/topology-runtime-v3
git commit -m "Build V3 topology runtime baseline"
```

### Task 3: Add Android host-v3 and keep V2/V3 side-by-side during migration

**Files:**
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Models.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Json.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Runtime.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Server.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Service.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Manager.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/test/java/com/impos2/adapterv2/topologyhostv3/**`
- Modify if needed: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/AndroidManifest.xml`
- Modify: `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/impos2/adapterv2/dev/ui/topologyhost/TopologyHostTestFragment.kt`

- [ ] **Step 1: Write the failing adapter host-v3 runtime test**

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/test/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3RuntimeTest.kt` with assertions for:

- one master + one slave occupancy
- duplicate master reject
- no ticket required for hello acceptance
- diagnostics snapshot contains current peer/session

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `./gradlew :3-adapter:android:adapter-android-v2:adapter-lib:testDebugUnitTest`

Expected: FAIL because `topologyhostv3` classes do not exist yet.

- [ ] **Step 3: Copy only the reusable shell from current host, then strip ticket-first behavior**

When creating V3 classes:

- reuse service/manager/status shell patterns from `topologyhost`
- remove public ticket issuance from the V3 happy path
- keep diagnostics/stats/fault rules
- keep start/stop lifecycle under manager control

- [ ] **Step 4: Implement the V3 runtime invariants**

The V3 runtime must support:

- `hello`
- `hello-ack`
- `state-snapshot`
- `state-update`
- `command-dispatch`
- `command-event`
- `request-snapshot`

and enforce:

- single pair occupancy
- reconnect by fresh hello
- current pair metadata in diagnostics

- [ ] **Step 5: Add host-v3 manager/service lifecycle tests**

Prove:

- `start()` returns address info
- `stop()` transitions to stopped cleanly
- `getStatus()` and `getStats()` expose useful diagnostics
- V3 host can run without enabling any ticket endpoint

- [ ] **Step 6: Update the dev/test fragment to exercise both host generations intentionally**

The dev fragment should not silently switch semantics. It must expose a V3 lane explicitly and keep V2 lane available until migration is complete.

- [ ] **Step 7: Run adapter host-v3 tests**

Run: `./gradlew :3-adapter:android:adapter-android-v2:adapter-lib:testDebugUnitTest`

Expected: PASS with new V3 tests included.

- [ ] **Step 8: Commit the Android host-v3 layer**

```bash
git add 3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3 \
        3-adapter/android/adapter-android-v2/adapter-lib/src/test/java/com/impos2/adapterv2/topologyhostv3 \
        3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/impos2/adapterv2/dev/ui/topologyhost/TopologyHostTestFragment.kt
git commit -m "Add Android topology host V3"
```

### Task 4: Migrate assembly and UI from V2 topology to V3 without breaking Product gating

**Files:**
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/bootstrapRuntime.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createModule.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/resolveTopologyLaunch.ts`
- Create or modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology-v3/**`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/startup/TopologyLaunchCoordinator.kt`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/TopologyHostTurboModule.kt`
- Modify: `2-ui/2.1-base/admin-console/src/types/admin.ts`
- Modify: `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`
- Modify: `2-ui/2.1-base/terminal-console/src/ui/screens/ActivateDeviceScreen.tsx`
- Modify: `2-ui/2.1-base/terminal-console/src/hooks/useDeviceActivation.ts`
- Modify: `2-ui/2.1-base/runtime-react/test-expo/startTopologyHost.ts`
- Modify: `2-ui/2.1-base/runtime-react/test-expo/topologyHostAssembly.ts`
- Modify tests:
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-resolve-topology-launch.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-bootstrap-runtime.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-admin-console-automation.spec.tsx`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-state-storage.spec.ts`
  - `2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx`
  - `2-ui/2.1-base/terminal-console/test/scenarios/terminal-console-rendered.spec.tsx`

- [ ] **Step 1: Write failing assembly tests for V3 startup/binding behavior**

Add or rewrite tests so they assert:

- `displayIndex` is treated as required for V3 topology bootstrap
- single-screen master defaults to host stopped until `enableSlave=true`
- single-screen slave uses locator, not ticket
- managed secondary still disables state persistence
- standalone slave keeps state persistence even when `instanceMode='SLAVE'`

- [ ] **Step 2: Run assembly topology-focused tests to verify failure**

Run:

```bash
corepack yarn vitest run \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-resolve-topology-launch.spec.ts \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-bootstrap-runtime.spec.ts
```

Expected: FAIL because V3 wiring does not exist yet.

- [ ] **Step 3: Replace assembly topology port wiring with V3 imports**

Migrate `src/platform-ports/topology.ts` and related assembly topology helpers so that:

- socket binding uses V3 profile/server name
- no hello ticket token is required
- `masterLocator` and assembly binding source remain synchronized
- Product mode still does not auto-start automation or debug-only surfaces

- [ ] **Step 4: Move `enableSlave -> host start/stop` binding fully into assembly**

Implement a store-driven assembly observer that:

- starts V3 host for single-screen `MASTER + enableSlave=true`
- stops V3 host for single-screen `MASTER + enableSlave=false`
- does not start host for `SLAVE`
- does not require core actors to call native host directly

- [ ] **Step 5: Rewrite admin panel and activation page against shared V3 eligibility selectors**

Required behavior:

- activation page blocks `SLAVE`
- activation page blocks managed secondary
- admin panel explains disabled reasons
- admin panel exposes host status, locator import/export, reconnect, disconnect
- standalone slave can change display mode where allowed

- [ ] **Step 6: Migrate Expo/browser topology helpers to V3 host**

Update runtime-react Expo helpers so they use:

- `dual-topology-host-v3`
- locator-based connection
- no ticket bootstrap path

- [ ] **Step 7: Run the affected UI and assembly suites**

Run:

```bash
corepack yarn vitest run 2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx
corepack yarn vitest run 2-ui/2.1-base/terminal-console/test/scenarios/terminal-console-rendered.spec.tsx
corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/index.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the assembly/UI V3 migration layer**

```bash
git add 2-ui/2.1-base/admin-console \
        2-ui/2.1-base/terminal-console \
        2-ui/2.1-base/runtime-react/test-expo \
        4-assembly/android/mixc-retail-assembly-rn84
git commit -m "Migrate assembly and UI topology flows to V3"
```

### Task 5: Migrate kernel live harnesses and package consumers off `topology-runtime-v2`

**Files:**
- Modify: `1-kernel/1.1-base/ui-runtime-v2/test/helpers/liveHarness.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-hot-update-master-slave-sync.spec.ts`
- Modify: `2-ui/2.1-base/runtime-react/test/support/runtimeReactHarness.tsx`
- Modify: `2-ui/2.1-base/runtime-react/test/support/runtimeReactScenarioParts.tsx`
- Modify: `2-ui/2.1-base/runtime-react/test/support/RuntimeReactScenarioStatePanel.tsx`
- Modify: `2-ui/2.3-integration/retail-shell/src/ui/screens/RootScreen.tsx`
- Modify package manifests that still depend on `@impos2/kernel-base-topology-runtime-v2`

- [ ] **Step 1: Produce the failing import audit**

Run and save the audit:

```bash
rg -n "@impos2/kernel-base-topology-runtime-v2|dual-topology-host" 1-kernel 2-ui 3-adapter 4-assembly 0-mock-server -g '!**/build/**' -g '!**/dist/**' -g '!**/node_modules/**'
```

Expected: multiple remaining V2 references.

- [ ] **Step 2: Rewrite live harnesses to V3 helpers first**

Replace the shared harness/test-helper imports before rewriting every consumer test. This keeps the repo-wide change smaller and easier to verify.

- [ ] **Step 3: Migrate consumer packages from V2 selectors/commands to V3 selectors/commands**

Package-level rule:

- only keep temporary compatibility shims if a package cannot move in one pass
- if a shim is introduced, list it in the commit body and delete it before Task 7 completes

- [ ] **Step 4: Run kernel/UI suites that previously depended on V2**

Run:

```bash
corepack yarn vitest run 1-kernel/1.1-base/ui-runtime-v2/test
corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test
corepack yarn vitest run 2-ui/2.1-base/runtime-react/test
```

Expected: PASS.

- [ ] **Step 5: Commit the consumer migration**

```bash
git add 1-kernel/1.1-base/ui-runtime-v2 \
        1-kernel/1.1-base/tdp-sync-runtime-v2 \
        2-ui/2.1-base/runtime-react \
        2-ui/2.3-integration/retail-shell
git commit -m "Migrate package consumers from topology V2 to V3"
```

### Task 6: Verify RN84 on emulator and real device through direct socket RPC before deleting old packages

**Files:**
- Reference script: `scripts/android-automation-rpc.mjs`
- Reference script: `scripts/mock-platform-prepare-activation.mjs`
- Reference script: `scripts/android-assembly-visible-admin-loop.mjs`
- Modify or create if needed: `scripts/android-topology-v3-verification.mjs`
- Modify if needed: `_old_/1-kernel/server-config-v2/src/serverName.ts`
- Modify if needed: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-live-admin-loop.spec.tsx`

- [ ] **Step 1: Add or update a direct-RPC verification helper for V3**

The helper must drive these checks without relying only on high-level UI scripts:

- `runtime.getInfo`
- `runtime.getState`
- `runtime.selectState`
- `runtime.getCurrentScreen`
- `ui.getNode`
- `command.dispatch`
- `wait.forState`
- `wait.forIdle`

- [ ] **Step 2: Verify cold-start primary/secondary readiness on emulator**

Run direct RPC smoke on both targets and record:

- current screen
- topology context
- activation status
- host status
- current peer info

Expected: both targets alive; if secondary is missing, treat it as a bug and fix before continuing.

- [ ] **Step 3: Verify direct state sync by command, not by full business flow first**

Use socket RPC to dispatch a state-changing command to primary, then prove both of these:

- secondary runtime state changes as expected
- secondary visible UI node text changes as expected

Then dispatch a slave-authoritative change and prove it returns to master.

- [ ] **Step 4: Verify activation restriction and admin topology actions on emulator**

Use socket RPC plus visible admin flow to prove:

- slave cannot activate
- managed secondary cannot activate
- activated master cannot switch to slave
- enableSlave starts/stops host correctly
- locator import/export and reconnect work

- [ ] **Step 5: Verify real-device RN84 flow using the automation socket**

Required evidence on a real device:

- startup info from `runtime.getInfo`
- topology context for both targets where applicable
- at least one direct primary->secondary sync proof via state + UI node readback
- at least one direct slave->master sync proof via state readback
- activation and deactivation flow observation through RPC and logs

- [ ] **Step 6: Run targeted logs while reproducing failures**

When anything fails, clear logs, add targeted TS/native logs, rerun once, and read them with timestamps. Do not proceed based on architectural guesses.

- [ ] **Step 7: Save verification evidence in repo artifacts**

Store emulator/real-device verification notes in a new artifact such as:

- `ai-result/2026-04-19-topology-runtime-v3-device-verification.md`

Include exact commands, observed states, and whether the old packages are still needed.

- [ ] **Step 8: Commit the verification helpers and evidence artifact**

```bash
git add scripts ai-result/2026-04-19-topology-runtime-v3-device-verification.md
git commit -m "Record topology V3 device verification evidence"
```

### Task 7: Delete `dual-topology-host` and `topology-runtime-v2`, then rerun the affected suites

**Files:**
- Delete: `0-mock-server/dual-topology-host/**`
- Delete: `1-kernel/1.1-base/topology-runtime-v2/**`
- Modify: `1-kernel/1.1-base/README.md`
- Modify: `2-ui/2.1-base/README.md`
- Modify: any package manifest or source file still referencing V2 / old host
- Modify memory/docs if used for planning norms:
  - `.omx/project-memory.json`
  - docs/spec references that still point to V2 as the current path

- [ ] **Step 1: Re-run the V2 import audit and reduce it to zero**

Run:

```bash
rg -n "@impos2/kernel-base-topology-runtime-v2|@impos2/dual-topology-host|dual-topology-host" 1-kernel 2-ui 3-adapter 4-assembly 0-mock-server -g '!**/build/**' -g '!**/dist/**' -g '!**/node_modules/**'
```

Expected: only the old package directories themselves remain.

- [ ] **Step 2: Delete the old packages**

Delete:

- `0-mock-server/dual-topology-host`
- `1-kernel/1.1-base/topology-runtime-v2`

- [ ] **Step 3: Update server-config and docs naming where necessary**

If V3 becomes the default topology host, update constants/docs so the repo no longer documents the removed packages as active dependencies.

- [ ] **Step 4: Run the full affected verification set again after deletion**

Run at minimum:

```bash
corepack yarn vitest run 0-mock-server/dual-topology-host-v3/test
corepack yarn vitest run 1-kernel/1.1-base/topology-runtime-v3/test
corepack yarn vitest run 1-kernel/1.1-base/ui-runtime-v2/test
corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test
corepack yarn vitest run 2-ui/2.1-base/admin-console/test
corepack yarn vitest run 2-ui/2.1-base/terminal-console/test
corepack yarn vitest run 2-ui/2.1-base/runtime-react/test
corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test
```

Expected: PASS.

- [ ] **Step 5: Perform one final emulator/real-device sanity check after deletion**

Use direct RPC smoke and one sync proof again so package deletion is validated against a real assembled app, not only test doubles.

- [ ] **Step 6: Commit the replacement completion**

```bash
git add -A
git commit -m "Replace topology V2 and remove obsolete host/runtime packages"
```

### Task 8: Self-review and handoff

**Files:**
- Modify if needed: `docs/superpowers/plans/2026-04-19-topology-runtime-v3-replacement-implementation.md`
- Modify if needed: `docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md`

- [ ] **Step 1: Re-scan the plan for placeholders or hidden V2 assumptions**

Run:

```bash
rg -n "TODO|TBD|implement later|similar to|appropriate error handling|should just work" docs/superpowers/plans/2026-04-19-topology-runtime-v3-replacement-implementation.md
```

Expected: no matches.

- [ ] **Step 2: Reconcile plan against the V3 spec and release gates**

Check manually that each of these has an explicit task path:

- no-ticket pair host
- V3 topology runtime
- assembly host lifecycle binding
- admin/activation restrictions
- TDP migration boundary
- real-device socket verification
- deletion of old packages

- [ ] **Step 3: Commit only if the plan itself needed cleanup**

```bash
git add docs/superpowers/plans/2026-04-19-topology-runtime-v3-replacement-implementation.md docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md
git commit -m "Polish topology V3 replacement plan"
```
