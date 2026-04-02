# Electron Mixc Retail V1 Design

## Context

This repo already has a layered architecture:

- `1-kernel`: business foundations and modules
- `2-ui`: UI cores, modules, and integrations
- `3-adapter`: platform adapters
- `4-assembly`: product assemblies

The current Android target for reference is:

- `3-adapter/android/adapterPure`
- `4-assembly/android/mixc-retail-rn84v2`

The new target is to add:

- `3-adapter/electron/adapterV1`
- `4-assembly/electron/mixc-retail-v1`

The Electron product must run the same TS business logic on desktop using React Native Web packaging, while preserving the architectural intent of the Android layered model.

## Confirmed Decisions

- Electron V1 uses `dual-window, dual-runtime`
- Electron V1 uses `strict bridge`
- The first version must cover all 7 adapter capabilities:
  - `logger`
  - `device`
  - `stateStorage`
  - `externalConnector`
  - `scriptsExecution`
  - `localWebServer`
  - `appControl`
- `externalConnector` follows a compatibility strategy:
  - keep full `ChannelType` API
  - first-class support for desktop-feasible channels
  - unsupported Android-only channels return explicit errors
- Delivery target is `near-production`
- `stateStorage` uses `better-sqlite3` for stability and Linux/Electron support

## Goals

- Add an Electron adapter and Electron assembly that preserve the existing repo layering
- Run `1-kernel` and `2-ui` business logic in Electron via React Native Web
- Keep primary and secondary screens as separate runtimes with separate stores
- Keep host responsibilities in assembly and platform capabilities in adapter
- Preserve strict renderer isolation:
  - `contextIsolation: true`
  - `nodeIntegration: false`
- Make the solution viable for Linux-based desktop deployment
- Support both development and packaged delivery

## Non-Goals

- Do not mirror Android process architecture literally
- Do not make renderer code call Electron APIs directly
- Do not replace existing business interconnection logic with ad-hoc Electron IPC
- Do not implement auto-update in V1
- Do not require Android-only connectors such as `INTENT` or `AIDL` to work on desktop

## Architecture Choice

### Chosen Approach: Host Shell + Service Container

Electron V1 uses a main-process host shell plus explicit service container.

Why this approach:

- it matches the role split of Android `mixc-retail-rn84v2`
- it keeps `adapterV1` as a reusable platform adapter instead of scattering Electron calls into assembly
- it preserves strict bridge discipline
- it allows later evolution of heavy services into utility processes without redesigning the whole app

Rejected alternatives:

- monolithic main-process host:
  - faster to start, but adapter and assembly responsibilities blur quickly
- utility-process-heavy architecture:
  - stronger isolation, but too expensive for V1 in coordination, packaging, and debugging

## Layered Responsibilities

### `3-adapter/electron/adapterV1`

Platform adapter only.

Responsibilities:

- implement the 7 Electron platform capabilities
- define typed contracts shared by main, preload, and renderer
- expose safe preload APIs
- provide renderer-side adapter wrappers that match kernel interfaces

Non-responsibilities:

- no business orchestration
- no product-specific window flow
- no direct dependency on `2-ui` business modules

### `4-assembly/electron/mixc-retail-v1`

Product assembly and host orchestrator.

Responsibilities:

- Electron app entry
- create and coordinate primary and secondary windows
- inject launch context into each renderer
- mount React Native Web renderer entries
- register the 7 adapters in JS
- manage restart flow, loading flow, packaged resource resolution, and environment configuration

Non-responsibilities:

- no direct Electron capability implementation outside the adapter contract

### `1-kernel` and `2-ui`

Remain business-facing and platform-agnostic.

Expected invariant:

- Electron still presents itself as `screenMode = desktop`
- business code should not know about Electron internals

## Package Structure

### `3-adapter/electron/adapterV1`

Recommended structure:

```text
3-adapter/electron/adapterV1/
  package.json
  tsconfig.json
  vite.main.config.ts
  vite.preload.config.ts
  vite.renderer.config.ts
  src/
    main/
      index.ts
      container/
      services/
        logger/
        device/
        stateStorage/
        externalConnector/
        scriptsExecution/
        localWebServer/
        appControl/
    preload/
      index.ts
      bridge/
    renderer/
      index.ts
      foundations/
        logger.ts
        device.ts
        stateStorage.ts
        externalConnector.ts
        scriptsExecution.ts
        localWebServer.ts
        appControl.ts
    shared/
      ipc/
      contracts/
      types/
      errors/
```

Public entry points:

- `@impos2/adapter-electron-v1/main`
- `@impos2/adapter-electron-v1/preload`
- `@impos2/adapter-electron-v1/renderer`
- `@impos2/adapter-electron-v1/shared`

### `4-assembly/electron/mixc-retail-v1`

Recommended structure:

```text
4-assembly/electron/mixc-retail-v1/
  package.json
  forge.config.ts
  tsconfig.json
  vite.config.ts
  electron/
    main/
      index.ts
      bootstrap/
      windows/
      lifecycle/
      paths/
    preload/
      index.ts
    renderer/
      bootstrap.tsx
      primary.tsx
      secondary.tsx
      index.html
      secondary.html
  src/
    application/
      modulePreSetup.ts
    features/
    foundations/
    supports/
    types/
    ui/
    index.ts
    store.ts
```

Key rule:

- renderer adapter wrappers belong in `adapterV1`, not in `mixc-retail-v1`

Reason:

- they are platform adaptation logic, not assembly business logic

## Runtime Model

### Main Process

Acts as host coordinator only, not as a business store host.

Responsibilities:

- app lifecycle
- window orchestration
- service container lifecycle
- preload binding
- path and config resolution
- packaged vs dev renderer resolution
- restart coordination

### Primary Renderer

Independent React Native Web runtime.

Responsibilities:

- build its own `ApplicationConfig`
- build its own store through `ApplicationManager.generateStore(...)`
- register adapters through `ensureModulePreSetup()`
- notify host when app load is complete

### Secondary Renderer

Same runtime rules as primary.

Required invariant:

- independent bootstrap
- independent store
- no shared in-memory state with primary renderer

## Launch Context

Each renderer receives a typed launch context injected by main process:

- `windowRole: 'primary' | 'secondary'`
- `displayIndex`
- `displayCount`
- `screenMode: 'desktop'`
- `deviceId`
- `isPackaged`
- `appVersion`
- `serverSpacePreset`
- `runtimeSource: 'dev-server' | 'bundled'`

This maps into `ApplicationConfig.environment` in the assembly store bootstrap.

## Window Lifecycle

### Startup Flow

1. Electron `app.whenReady()`
2. initialize paths, logs, storage, config
3. build `HostServiceContainer`
4. create primary window
5. inject primary launch context
6. primary renderer bootstraps and registers adapters
7. primary renderer signals `onAppLoadComplete(0)`
8. host decides whether a secondary display exists
9. if present, create secondary window
10. inject secondary launch context and bootstrap secondary renderer

### Restart Flow

`restartApp()` is a host-level restart, not a page refresh.

Flow:

1. renderer calls `appControl.restartApp()`
2. request enters main-process lifecycle service
3. reject duplicate restart requests
4. if local web server is running, stop it and wait for `STOPPED`
5. request controlled secondary window shutdown
6. wait for ACK or force-destroy on timeout
7. tear down primary and secondary renderers
8. rebuild windows, and optionally reset selected host services
9. recreate primary window
10. after primary ready, recreate secondary if display exists

Fallback:

- allow escalation to `app.relaunch() + app.exit(0)` if host state becomes inconsistent

### Crash and Recovery Rules

- primary renderer crash:
  - rebuild the whole host window stack
- secondary renderer crash:
  - rebuild the secondary window only
- display removal:
  - destroy secondary window and fall back to single-window mode

## Communication Model

There are three communication categories.

### Business Synchronization

Keep using existing kernel interconnection semantics.

Rule:

- do not replace business synchronization with ad-hoc Electron IPC

Primary and secondary business coordination should continue to rely on the local web server and existing interconnection flow.

### Host Control Messages

Use Electron IPC through typed contracts:

- renderer ready
- loading complete
- secondary requested
- secondary shutdown
- restart orchestration
- diagnostics

### Debug or Observability Messages

Optional host event bus is allowed for diagnostics only.

Rule:

- business logic must not depend on a private host event bus

## Strict Bridge Model

Renderer security settings:

- `contextIsolation: true`
- `nodeIntegration: false`
- no direct `ipcRenderer` exposure

Preload rules:

- expose only whitelisted APIs
- expose semantic methods, not raw IPC primitives
- all payloads must go through typed contracts from `adapterV1/shared`

Assembly rule:

- assembly code may consume bridge APIs only via adapter renderer wrappers

## Adapter Capability Mapping

### 1. Logger

Implementation location:

- main process

Behavior:

- file-backed logs under `userData/logs`
- renderer writes via bridge only
- support file listing, content reading, deletion, clearing, and path query
- enrich log context with `windowRole`, `displayIndex`, and request metadata

### 2. Device

Implementation location:

- main process

Behavior:

- use Electron `screen` and Node `os`
- expose display information for all connected displays
- expose desktop system status where available
- map unavailable Android-specific fields to safe desktop defaults or `unknown`
- use `powerMonitor` for power events where supported

### 3. State Storage

Implementation location:

- main process

Chosen library:

- `better-sqlite3`

Why:

- stable Electron/Linux support
- synchronous and predictable main-process access model
- easier consistency and debugging than renderer-managed storage
- better fit for near-production delivery than `localStorage` or JSON files

Model:

- lightweight key-value table
- single-writer ownership in main process
- renderer only sees `getItem`, `setItem`, `removeItem`

Packaging note:

- Electron packaging must include native rebuild handling for `better-sqlite3`

### 4. External Connector

Implementation location:

- main process

Strategy:

- compatibility layer
- preserve full `ChannelType` API
- desktop-feasible channels are first-class
- unsupported Android-only channels return explicit errors

Driver registry structure:

- `network`
- `serial`
- `hid`
- `bluetooth`
- `sdk`

V1 priorities:

- `NETWORK` fully supported
- `SDK` prepared for local SDK integration
- `SERIAL`, `USB`, `HID`, `BLUETOOTH` allowed to be partially implemented or unavailable
- `INTENT`, `AIDL` explicitly unsupported on desktop

### 5. Scripts Execution

Implementation location:

- main process

Execution model:

- host executes script in an isolated executor
- renderer can still provide `nativeFunctions`
- script callback requests round-trip through typed bridge events

Recommended executor:

- `worker_threads`

Reason:

- avoid blocking the main Electron thread with script evaluation

### 6. Local Web Server

Implementation location:

- main process

Behavior:

- implemented with Node `http` + `ws`
- only primary role controls lifecycle
- preserve kernel interconnection semantics
- keep Android-equivalent status API:
  - `startLocalWebServer`
  - `stopLocalWebServer`
  - `getLocalWebServerStatus`
  - `getLocalWebServerStats`

Critical rule:

- do not replace local web server business flow with private Electron IPC

### 7. App Control

Implementation location:

- main process

Behavior mapping:

- `setFullScreen` -> `BrowserWindow.setFullScreen()`
- `isFullScreen` -> current window fullscreen state
- `setAppLocked` -> `BrowserWindow.setKiosk()`
- `isAppLocked` -> current kiosk state
- `onAppLoadComplete(displayIndex)` -> notify host that a specific renderer is ready
- `restartApp()` -> trigger the host restart flow

Rules:

- secondary renderer cannot directly control global host lifecycle
- assembly-wide restart is owned by main process orchestration

## Build and Packaging

## Recommended Tooling

- Electron Forge for app shell, packaging, and distribution
- Vite for main, preload, and renderer builds
- React Native Web for renderer adaptation

Why not Expo Web as the assembly runtime:

- Electron needs first-class control of main/preload/renderer
- packaged resource handling is clearer with Forge + Vite
- strict bridge control is easier with a dedicated Electron toolchain

## Required Commands

At minimum:

- `adapter:electron-v1:type-check`
- `assembly:electron-mixc-retail-v1:dev`
- `assembly:electron-mixc-retail-v1:package`
- `assembly:electron-mixc-retail-v1:make`

## Delivery Targets

Initial targets:

- macOS `dmg` or `zip`
- Windows `nsis` or `zip`
- Linux package or distributable directory appropriate to deployment environment

## Runtime Paths

Centralize host paths behind a `PathService`.

Required logical directories:

- `userData/logs`
- `userData/storage`
- `userData/config`
- `userData/runtime`

Rule:

- no scattered `app.getPath(...)` access outside path infrastructure

## Testing Strategy

### 1. Service Unit Tests

Test main-process services in isolation:

- logger
- stateStorage
- scriptsExecution
- externalConnector

### 2. IPC Contract Tests

Validate:

- request/response payloads
- event subscription behavior
- preload exposure surface
- security invariants

### 3. Dual-Window Integration Tests

Minimum scenarios:

- primary window startup
- secondary window startup
- no-secondary-display fallback
- controlled restart
- local web server stop/restart flow
- secondary recovery after teardown

### 4. Business Smoke Tests

Use adapter-focused UI or debug screens to verify:

- logger
- device
- stateStorage
- externalConnector
- scriptsExecution
- localWebServer
- appControl

Highest-value automated checks for V1:

- `restartApp`
- secondary recovery
- state persistence
- local web server lifecycle
- `externalConnector` network mode

## Risks and Controls

### Risk 1: Fake Dual Runtime

Problem:

- two windows appear separate but actually share state or bootstrap paths

Control:

- separate renderer entry files
- separate store creation
- separate launch contexts

### Risk 2: Renderer Boundary Erosion

Problem:

- renderer starts depending directly on Electron or Node APIs

Control:

- strict preload-only bridge
- no raw IPC exposure
- adapter renderer wrappers as the only consumption surface

### Risk 3: Restart Degrades to Refresh

Problem:

- host restart is implemented as `window.location.reload()`

Control:

- restart is owned by main process lifecycle service

### Risk 4: Connector Complexity Explosion

Problem:

- desktop connector support turns into unbounded special cases

Control:

- explicit driver registry
- explicit unsupported error codes
- prioritize `NETWORK` first

### Risk 5: Architecture Drift from Existing Business Model

Problem:

- Electron introduces private host message paths that bypass interconnection

Control:

- keep business synchronization on the existing local web server and kernel interconnection path

## Implementation Phases

### Phase 1: Skeleton

- create `adapterV1` and `mixc-retail-v1`
- establish Forge + Vite build
- create main/preload/renderer entries
- boot empty primary and secondary windows

### Phase 2: Foundational Host Capabilities

- implement `logger`
- implement `stateStorage`
- implement `device`
- implement `appControl`
- prove dual-window independent startup with business bootstrap

### Phase 3: Host Lifecycle

- implement launch context injection
- implement loading and ready signaling
- implement restart orchestration
- implement secondary display detection and recovery

### Phase 4: Communication Capabilities

- implement `localWebServer`
- implement `externalConnector`
- implement `scriptsExecution`
- prioritize `NETWORK` mode for connector

### Phase 5: Near-Production Hardening

- packaging
- path normalization
- configuration injection
- crash recovery
- smoke and integration coverage

## Practical Guidance for Implementation

- first prove that both windows can independently mount the React Native Web app and each generate its own store
- only after the dual-runtime foundation is stable should communication-heavy adapters be added
- keep adapter service contracts typed from day one
- keep `modulePreSetup.ts` in assembly, but source adapters from `@impos2/adapter-electron-v1/renderer`

## Source Notes

The host capability mapping and safety assumptions align with official Electron APIs:

- `contextBridge`
- `screen`
- `powerMonitor`
- `BrowserWindow`

References:

- https://www.electronjs.org/docs/latest/api/context-bridge
- https://www.electronjs.org/docs/latest/api/screen/
- https://www.electronjs.org/docs/latest/api/power-monitor/
- https://www.electronjs.org/docs/latest/api/browser-window/

The storage choice also considered official project documentation for:

- `better-sqlite3`
- `lmdb`
- Node `sqlite`

References:

- https://github.com/WiseLibs/better-sqlite3
- https://github.com/WiseLibs/better-sqlite3/releases
- https://github.com/kriszyp/lmdb-js
- https://nodejs.org/api/sqlite.html
