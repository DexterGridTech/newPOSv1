# Electron Mixc Retail V1 Implementation Plan

> **For implementation work:** follow the approved spec in `docs/superpowers/specs/2026-04-02-electron-mixc-retail-v1-design.md`. Execute this plan in order. Do not collapse phases. Keep adapter capability boundaries strict and do not let renderer code call Electron APIs directly.

**Goal:** create `3-adapter/electron/adapterV1` and `4-assembly/electron/mixc-retail-v1` so the existing TS business logic can run in Electron using React Native Web, with dual-window dual-runtime behavior, strict preload bridge, and near-production packaging support.

**Architecture:** Electron main process acts as host shell and service orchestrator. Adapter capabilities live in `adapterV1` main/preload/renderer/shared layers. Product assembly owns window orchestration, renderer bootstrap, adapter registration, lifecycle flow, and packaged delivery. Primary and secondary windows run separate renderer entries and separate stores.

**Tech Stack:** Electron Forge, Vite, TypeScript, React Native Web, Electron preload bridge, Node `http`, `ws`, `better-sqlite3`

---

## Phase 0: Workspace and Tooling Baseline

### Task 0.1: Verify workspace assumptions and add root scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Electron-oriented root scripts**

Add scripts for:

- `adapter:electron-v1:type-check`
- `assembly:electron-mixc-retail-v1:dev`
- `assembly:electron-mixc-retail-v1:package`
- `assembly:electron-mixc-retail-v1:make`

Use the same naming style already present in the root workspace scripts.

- [ ] **Step 2: Add or update any root-level Electron build dependencies only if they are truly shared**

Prefer package-local dependencies. Do not pollute the root unless multiple packages need the same tool.

- [ ] **Step 3: Verify workspace discovery**

From repo root:

```bash
corepack yarn workspaces list | rg "adapter-electron-v1|assembly-electron-mixc-retail-v1"
```

Expected:

- both new workspaces resolve after package scaffolding is added

---

## Phase 1: Scaffold `adapterV1` and `mixc-retail-v1`

### Task 1.1: Create `3-adapter/electron/adapterV1`

**Files:**
- Create: `3-adapter/electron/adapterV1/package.json`
- Create: `3-adapter/electron/adapterV1/tsconfig.json`
- Create: `3-adapter/electron/adapterV1/src/main/index.ts`
- Create: `3-adapter/electron/adapterV1/src/preload/index.ts`
- Create: `3-adapter/electron/adapterV1/src/renderer/index.ts`
- Create: `3-adapter/electron/adapterV1/src/shared/index.ts`

- [ ] **Step 1: Create package skeleton**

Create the package directory and source tree exactly as described in the approved spec.

- [ ] **Step 2: Define package exports**

Expose:

- `./main`
- `./preload`
- `./renderer`
- `./shared`

The package name should match the spec naming convention:

- `@impos2/adapter-electron-v1`

- [ ] **Step 3: Add adapter-local dependencies**

At minimum plan for:

- `typescript`
- Electron-related type packages as needed
- `better-sqlite3`
- `ws`

Do not add assembly-specific business packages here.

### Task 1.2: Create `4-assembly/electron/mixc-retail-v1`

**Files:**
- Create: `4-assembly/electron/mixc-retail-v1/package.json`
- Create: `4-assembly/electron/mixc-retail-v1/forge.config.ts`
- Create: `4-assembly/electron/mixc-retail-v1/tsconfig.json`
- Create: `4-assembly/electron/mixc-retail-v1/electron/main/index.ts`
- Create: `4-assembly/electron/mixc-retail-v1/electron/preload/index.ts`
- Create: `4-assembly/electron/mixc-retail-v1/electron/renderer/bootstrap.tsx`
- Create: `4-assembly/electron/mixc-retail-v1/electron/renderer/primary.tsx`
- Create: `4-assembly/electron/mixc-retail-v1/electron/renderer/secondary.tsx`
- Create: `4-assembly/electron/mixc-retail-v1/electron/renderer/index.html`
- Create: `4-assembly/electron/mixc-retail-v1/electron/renderer/secondary.html`
- Create: `4-assembly/electron/mixc-retail-v1/src/application/modulePreSetup.ts`
- Create: `4-assembly/electron/mixc-retail-v1/src/store.ts`

- [ ] **Step 1: Create package skeleton**

Create assembly structure from the approved spec.

- [ ] **Step 2: Add package dependencies**

At minimum:

- `@impos2/adapter-electron-v1` via local file dependency
- `@impos2/kernel-core-interconnection`
- `@impos2/kernel-server-config`
- `@impos2/ui-integration-mixc-retail`
- `react`
- `react-dom`
- `react-native`
- `react-native-web`
- `react-redux`

Pin actual versions in assembly `dependencies`.

- [ ] **Step 3: Add Electron Forge + Vite toolchain**

Set up package-local dev dependencies for:

- Electron
- Electron Forge
- Forge Vite plugin or equivalent Vite-based Electron build pipeline

### Task 1.3: Establish minimal type-checkability

**Files:**
- Modify: package configs in both new packages

- [ ] **Step 1: Run TypeScript checks for the new packages**

Commands:

```bash
corepack yarn workspace @impos2/adapter-electron-v1 type-check
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check
```

Expected:

- both packages pass with minimal compilable skeleton implementations

---

## Phase 2: Core Shared Contracts and Strict Bridge

### Task 2.1: Define shared IPC contracts

**Files:**
- Create: `3-adapter/electron/adapterV1/src/shared/ipc/channels.ts`
- Create: `3-adapter/electron/adapterV1/src/shared/contracts/*.ts`
- Create: `3-adapter/electron/adapterV1/src/shared/types/*.ts`
- Create: `3-adapter/electron/adapterV1/src/shared/errors/*.ts`

- [ ] **Step 1: Define semantic IPC channels**

Do not expose raw channel names ad hoc. Group by capability:

- logger
- device
- stateStorage
- externalConnector
- scriptsExecution
- localWebServer
- appControl
- host lifecycle
- launch context

- [ ] **Step 2: Define payload types**

Every request/response/event payload used between main, preload, and renderer must have a typed definition.

- [ ] **Step 3: Define explicit unsupported error codes**

Especially for `externalConnector` desktop-incompatible channels.

### Task 2.2: Implement preload bridge surface

**Files:**
- Create or modify: `3-adapter/electron/adapterV1/src/preload/index.ts`
- Create: `3-adapter/electron/adapterV1/src/preload/bridge/*.ts`

- [ ] **Step 1: Expose a single whitelisted preload namespace**

Example shape:

- `window.impos2Host`
- or equivalent project-specific namespace

Do not expose `ipcRenderer`.

- [ ] **Step 2: Expose semantic APIs only**

Examples:

- `logger.log(...)`
- `device.getDeviceInfo()`
- `stateStorage.getItem(...)`

Avoid generic `invoke(channel, payload)` patterns in renderer-facing code.

- [ ] **Step 3: Enable typed event subscription**

Required for:

- power status changes
- connector stream and passive events
- script native-function callbacks if needed
- host lifecycle notifications

### Task 2.3: Implement renderer adapter wrappers

**Files:**
- Create: `3-adapter/electron/adapterV1/src/renderer/foundations/*.ts`
- Modify: `3-adapter/electron/adapterV1/src/renderer/index.ts`

- [ ] **Step 1: Implement wrappers matching kernel interfaces**

The exported adapters must be directly usable by assembly `modulePreSetup.ts`.

- [ ] **Step 2: Ensure renderer wrappers depend only on preload API**

No Electron imports in renderer foundation files.

- [ ] **Step 3: Add local type-check validation**

Command:

```bash
corepack yarn workspace @impos2/adapter-electron-v1 type-check
```

Expected:

- wrappers compile against kernel interfaces

---

## Phase 3: Assembly Host Shell and Dual Renderer Boot

### Task 3.1: Create main-process host shell

**Files:**
- Create: `4-assembly/electron/mixc-retail-v1/electron/main/bootstrap/*.ts`
- Create: `4-assembly/electron/mixc-retail-v1/electron/main/windows/*.ts`
- Create: `4-assembly/electron/mixc-retail-v1/electron/main/lifecycle/*.ts`
- Create: `4-assembly/electron/mixc-retail-v1/electron/main/paths/*.ts`
- Modify: `4-assembly/electron/mixc-retail-v1/electron/main/index.ts`

- [ ] **Step 1: Implement `PathService`**

Centralize all runtime directories:

- logs
- storage
- config
- runtime

- [ ] **Step 2: Implement `WindowOrchestrator`**

Responsibilities:

- create primary window
- detect displays
- create secondary window when a second display exists
- restore or destroy secondary window on display changes

- [ ] **Step 3: Enforce secure `BrowserWindow` defaults**

Required flags:

- `contextIsolation: true`
- `nodeIntegration: false`
- use preload entry only

### Task 3.2: Inject launch context per renderer

**Files:**
- Create or modify: launch context types and preload access points

- [ ] **Step 1: Define launch context structure**

Include:

- `windowRole`
- `displayIndex`
- `displayCount`
- `screenMode`
- `deviceId`
- `isPackaged`
- `appVersion`
- `serverSpacePreset`
- `runtimeSource`

- [ ] **Step 2: Provide per-window launch context retrieval in renderer**

The renderer must not infer role or display index from URL hacks.

### Task 3.3: Bootstrap React Native Web renderers

**Files:**
- Modify: `electron/renderer/bootstrap.tsx`
- Modify: `electron/renderer/primary.tsx`
- Modify: `electron/renderer/secondary.tsx`
- Create or modify: Vite config and aliases

- [ ] **Step 1: Configure React Native Web resolution**

Ensure `react-native` resolves to `react-native-web` in renderer build.

- [ ] **Step 2: Create separate primary and secondary renderer entries**

Both must use the same business `App`, but receive distinct launch contexts and bootstrap independently.

- [ ] **Step 3: Validate dual runtime**

Acceptance check:

- both windows create their own store
- neither window shares a store or singleton business bootstrap path with the other

### Task 3.4: Wire assembly module setup

**Files:**
- Modify: `4-assembly/electron/mixc-retail-v1/src/application/modulePreSetup.ts`
- Modify: `4-assembly/electron/mixc-retail-v1/src/store.ts`
- Create or modify: `App.tsx` equivalent for Electron assembly

- [ ] **Step 1: Register Electron adapters from `@impos2/adapter-electron-v1/renderer`**

Register:

- logger
- device
- stateStorage
- externalConnector
- scriptsExecution
- localWebServer
- appControl

- [ ] **Step 2: Build store from launch context**

Map launch context to `ApplicationConfig.environment`.

- [ ] **Step 3: Prove primary-only startup first**

Command:

```bash
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 dev
```

Expected:

- primary window opens
- React Native Web app mounts
- no direct Electron access errors in renderer

---

## Phase 4: Foundational Adapter Services

### Task 4.1: Implement `logger` service

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/logger/*`

- [ ] **Step 1: Implement file-backed log sink**

- [ ] **Step 2: Implement read/list/delete/clear APIs**

- [ ] **Step 3: Include window role metadata in log entries**

### Task 4.2: Implement `device` service

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/device/*`

- [ ] **Step 1: Use Electron `screen` and Node `os`**

- [ ] **Step 2: Map display metadata into kernel `DeviceInfo`**

- [ ] **Step 3: Implement safe desktop defaults for unsupported Android-specific fields**

- [ ] **Step 4: Wire `powerMonitor` event mapping**

### Task 4.3: Implement `stateStorage` service with `better-sqlite3`

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/stateStorage/*`

- [ ] **Step 1: Define schema**

Use a simple key-value model with metadata columns such as:

- namespace
- key
- value
- updatedAt

- [ ] **Step 2: Ensure single-writer main-process access**

The renderer must never open or write the database directly.

- [ ] **Step 3: Implement `getItem`, `setItem`, `removeItem` semantics**

Preserve current kernel adapter expectations.

- [ ] **Step 4: Add storage path and initialization logic**

Use `PathService` to locate the database under `userData/storage`.

### Task 4.4: Implement `appControl` service baseline

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/appControl/*`

- [ ] **Step 1: Map fullscreen state to `BrowserWindow`**

- [ ] **Step 2: Map lock mode to kiosk state**

- [ ] **Step 3: Implement `onAppLoadComplete(displayIndex)` ready reporting**

- [ ] **Step 4: Stub host restart hook entry**

This only needs to call into lifecycle orchestration at this phase.

### Task 4.5: Validate the first four capabilities end-to-end

**Files:**
- Add temporary diagnostics if needed in assembly debug UI

- [ ] **Step 1: Launch app and validate logger, device, storage, appControl**

- [ ] **Step 2: Confirm secondary window still boots independently**

- [ ] **Step 3: Run type-check**

Commands:

```bash
corepack yarn workspace @impos2/adapter-electron-v1 type-check
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check
```

---

## Phase 5: Host Lifecycle and Restart Orchestration

### Task 5.1: Implement loading and ready coordination

**Files:**
- Modify: assembly main lifecycle files
- Modify: appControl service and renderer startup flow

- [ ] **Step 1: Track renderer readiness per window role**

- [ ] **Step 2: Close loading state only after the intended renderer signals ready**

- [ ] **Step 3: Start secondary only after primary ready**

### Task 5.2: Implement controlled secondary shutdown flow

**Files:**
- Modify: host lifecycle and window orchestration files

- [ ] **Step 1: Add secondary shutdown request path**

- [ ] **Step 2: Add ACK or timeout handling**

- [ ] **Step 3: Force-destroy secondary on timeout**

### Task 5.3: Implement `restartApp()` as host restart

**Files:**
- Modify: lifecycle service and appControl service

- [ ] **Step 1: Reject duplicate restart requests**

- [ ] **Step 2: Stop local web server before rebuild if running**

- [ ] **Step 3: Close secondary, rebuild primary, then recreate secondary**

- [ ] **Step 4: Add fallback to `app.relaunch() + app.exit(0)` for unrecoverable host state**

### Task 5.4: Validate restart semantics

- [ ] **Step 1: Confirm restart is not a renderer refresh**

- [ ] **Step 2: Confirm both windows get rebuilt**

- [ ] **Step 3: Confirm stores are recreated**

---

## Phase 6: Local Web Server

### Task 6.1: Implement `localWebServer` with Node `http` + `ws`

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/localWebServer/*`

- [ ] **Step 1: Build HTTP server with explicit lifecycle states**

States:

- `STOPPED`
- `STARTING`
- `RUNNING`
- `STOPPING`
- `ERROR`

- [ ] **Step 2: Add WebSocket upgrade handling**

- [ ] **Step 3: Implement status and stats APIs**

- [ ] **Step 4: Restrict control ownership to primary role or host orchestrator**

### Task 6.2: Preserve interconnection compatibility

- [ ] **Step 1: Keep path conventions aligned with current kernel expectations**

- [ ] **Step 2: Verify business interconnection uses local server, not Electron private IPC**

### Task 6.3: Validate local web server behavior

- [ ] **Step 1: Start and stop from the app**

- [ ] **Step 2: Verify reported addresses**

- [ ] **Step 3: Verify restart flow stops it cleanly before window rebuild**

---

## Phase 7: External Connector Compatibility Layer

### Task 7.1: Implement connector driver registry

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/externalConnector/*`

- [ ] **Step 1: Define a driver registry interface**

- [ ] **Step 2: Implement explicit unsupported handling**

Return consistent error codes for unsupported desktop channels.

- [ ] **Step 3: Implement `NETWORK` driver first**

Support:

- request-response
- stream
- passive events where meaningful

### Task 7.2: Add desktop-feasible stubs or partial drivers

- [ ] **Step 1: Prepare extension points for `SDK`, `SERIAL`, `USB`, `HID`, `BLUETOOTH`**

- [ ] **Step 2: Mark `INTENT` and `AIDL` as unsupported on desktop**

### Task 7.3: Validate connector behavior

- [ ] **Step 1: Verify `isAvailable`**

- [ ] **Step 2: Verify `getAvailableTargets`**

- [ ] **Step 3: Verify subscription and unsubscribe cleanup**

---

## Phase 8: Scripts Execution

### Task 8.1: Implement isolated script execution service

**Files:**
- Create: `3-adapter/electron/adapterV1/src/main/services/scriptsExecution/*`

- [ ] **Step 1: Build executor using `worker_threads`**

- [ ] **Step 2: Support timeout handling**

- [ ] **Step 3: Support renderer-provided `nativeFunctions` callback round-trips**

- [ ] **Step 4: Ensure one execution cannot block the Electron main thread**

### Task 8.2: Validate script execution

- [ ] **Step 1: Run script success path**

- [ ] **Step 2: Run timeout path**

- [ ] **Step 3: Run native-function callback path**

---

## Phase 9: Packaging and Near-Production Hardening

### Task 9.1: Configure packaged resource resolution

**Files:**
- Modify: Forge and Vite config
- Modify: path/bootstrap logic

- [ ] **Step 1: Ensure dev mode loads renderer from dev server**

- [ ] **Step 2: Ensure packaged mode loads local built assets**

- [ ] **Step 3: Ensure preload and main are independent of dev server**

### Task 9.2: Configure native module packaging

**Files:**
- Modify: Forge config and package scripts

- [ ] **Step 1: Add native rebuild flow for `better-sqlite3`**

- [ ] **Step 2: Verify Linux packaging path explicitly**

### Task 9.3: Add runtime diagnostics and crash handling

- [ ] **Step 1: Track renderer crashes and unresponsive events**

- [ ] **Step 2: Rebuild secondary on secondary crash**

- [ ] **Step 3: Rebuild host window stack on primary crash**

### Task 9.4: Produce distributable artifacts

- [ ] **Step 1: Build package**

Command:

```bash
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 package
```

- [ ] **Step 2: Build make artifacts**

Command:

```bash
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 make
```

Expected:

- packaged app or distributable directory builds successfully

---

## Phase 10: Verification, Test Results, and Cleanup

### Task 10.1: Type-check and smoke-test full system

- [ ] **Step 1: Run package-local type-checks**

```bash
corepack yarn workspace @impos2/adapter-electron-v1 type-check
corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check
```

- [ ] **Step 2: Launch in dev mode and verify**

Checklist:

- primary window boots
- secondary window boots when second display exists
- logger works
- device works
- stateStorage persists
- localWebServer works
- externalConnector `NETWORK` works
- scriptsExecution works
- fullscreen and kiosk work
- restart rebuilds windows

### Task 10.2: Add test-results documentation

**Files:**
- Create: `docs/superpowers/test-results/2026-04-02-electron-mixc-retail-v1.md`

- [ ] **Step 1: Record verification outcomes**

Capture:

- environment
- build result
- dev smoke result
- packaging result
- known gaps or deferred items

### Task 10.3: Final review before implementation completion

- [ ] **Step 1: Verify no renderer code directly imports Electron**

Command:

```bash
rg -n "from 'electron'|from \"electron\"" 4-assembly/electron/mixc-retail-v1/electron/renderer 3-adapter/electron/adapterV1/src/renderer -S
```

Expected:

- no matches

- [ ] **Step 2: Verify business synchronization still uses existing interconnection path**

- [ ] **Step 3: Verify stateStorage remains main-process owned**

---

## Completion Checklist

- [ ] `3-adapter/electron/adapterV1` exists with main/preload/renderer/shared boundaries
- [ ] `4-assembly/electron/mixc-retail-v1` exists with Electron Forge + Vite build
- [ ] primary and secondary windows run separate renderer bootstraps
- [ ] both windows create separate stores
- [ ] strict preload bridge is enforced
- [ ] all 7 adapter capabilities are implemented
- [ ] `stateStorage` uses `better-sqlite3`
- [ ] `localWebServer` uses Node `http` + `ws`
- [ ] `externalConnector` supports compatibility behavior with `NETWORK` first
- [ ] packaged build works
- [ ] Linux packaging path has been verified
- [ ] test results are documented

## Constraints and Guardrails

1. Do not move adapter wrappers into assembly.
2. Do not let renderer call Electron APIs directly.
3. Do not replace business interconnection with custom Electron-only messaging.
4. Do not implement restart as renderer refresh.
5. Do not weaken `contextIsolation` or enable `nodeIntegration`.
6. Do not switch `stateStorage` away from `better-sqlite3` unless there is a documented blocking issue.
7. Do not switch `localWebServer` away from `http + ws` in V1 unless profiling proves a real bottleneck.

## Suggested Commit Boundaries

- Commit 1: scaffold adapter and assembly packages
- Commit 2: shared contracts and strict preload bridge
- Commit 3: dual-window host shell and renderer bootstrap
- Commit 4: logger/device/stateStorage/appControl
- Commit 5: lifecycle and restart orchestration
- Commit 6: localWebServer
- Commit 7: externalConnector
- Commit 8: scriptsExecution
- Commit 9: packaging and hardening
- Commit 10: tests and docs
