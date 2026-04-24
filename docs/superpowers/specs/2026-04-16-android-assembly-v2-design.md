# `adapter-android-v2` + `mixc-retail-assembly-rn84` Design

## Background

The next rebuild step is the Android native / assembly layer.

The old validated split is archived under `_old_` as reference-only:

1. [`_old_/3-adapter/android/adapterPure`](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/3-adapter/android/adapterPure)
2. [`_old_/4-assembly/android/mixc-retail-rn84v2`](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/4-assembly/android/mixc-retail-rn84v2)

That split has already been proven workable in practice.
The new rebuild must preserve that split instead of collapsing everything into one package.

The target stack is now:

1. `1-kernel/1.1-base/*`
2. `2-ui/2.1-base/*`
3. `2-ui/2.3-integration/retail-shell`
4. new Android adapter package
5. new Android assembly package

This is not a mechanical migration.
The goal is:

1. preserve the old validated native / assembly role split,
2. reuse old native capabilities where they are already good,
3. re-check old native design critically instead of copying blindly,
4. rebuild the assembly bootstrap around the new kernel / UI runtime,
5. replace the old `LocalWebServer` protocol model with a new native `topologyHost` aligned with the new topology architecture.

## Hard Constraints

The following constraints were explicitly confirmed during the design discussion.

### 1. Preserve the old adapter / assembly split

The new rebuild must keep two separate packages:

1. `3-adapter/android/adapter-android-v2`
2. `4-assembly/android/mixc-retail-assembly-rn84`

This split must not be collapsed.

### 2. `adapter-android-v2` remains pure Android

The adapter package must:

1. stay independent from React Native,
2. keep `adapter-lib` and `dev-app`,
3. expose reusable Android-native capabilities only,
4. be independently testable without the RN host app.

### 3. `mixc-retail-assembly-rn84` remains the RN bare assembly app

The assembly package must:

1. stay a full RN 0.84 bare application,
2. own RN host bootstrapping,
3. own TurboModule and codegen wiring,
4. own dual-display startup and restart orchestration,
5. own JS runtime composition with the new `1-kernel` / `2-ui` packages.

### 4. Old native capabilities should be reused when they are already good

Rebuild does not mean rewriting everything.

The default rule is:

1. old native implementation is reused first,
2. only unreasonable parts are redesigned,
3. architecture-level redesign points are discussed explicitly before changing them.

### 5. Old configuration coverage must not be lost

The new packages must inherit the useful configuration surface from the old successful packages, including:

1. Android SDK / Kotlin / Java compatibility,
2. Gradle project layout,
3. manifest permissions and service declarations,
4. RN 0.84 new architecture configuration,
5. Hermes and codegen configuration,
6. Metro / Babel / TypeScript configuration,
7. Reactotron DEV configuration,
8. dual-screen manifest and startup options.

This means “rebuild” is allowed to improve structure, but not to accidentally drop configuration that made the old app actually run.

### 6. Old `LocalWebServer` is not directly reusable as a protocol

This is the key exception.

The old `LocalWebServer` implementation in `adapterPure` is based on the old protocol model and must not be copied as-is.

Only its Android host-shell patterns may be reused, such as:

1. foreground service hosting,
2. service binding / manager facade,
3. start / stop / status lifecycle discipline,
4. notification management,
5. runtime diagnostics and threading discipline.

But the protocol surface itself must be rebuilt.

### 7. The new native service is `topologyHost`, not old `localWebServer`

The new native server capability should be renamed conceptually to `topologyHost`.

The reason is simple:

1. it is no longer a generic local web server,
2. it is specifically the embedded dual-topology host runtime for the app,
3. using the old name would keep developers in the wrong protocol mental model.

### 8. `topologyHost` must not be split into two visible layers

We explicitly reject the idea of:

1. a thin Android host shell in `adapter`,
2. plus a second protocol layer in `assembly`.

That split adds complexity without visible value.

The new rule is:

1. `topologyHost` is a full native capability in `adapter-android-v2`,
2. `assembly` only bridges it into RN and runtime bootstrap,
3. protocol behavior is implemented once, in the native layer.

### 9. Native `topologyHost` must match `dual-topology-host`

The Android native `topologyHost` must mirror the protocol and service behavior of:

[0-mock-server/dual-topology-host](/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host)

That package becomes the protocol truth source.

“Match” here means:

1. same HTTP routes,
2. same WS routes,
3. same message names,
4. same pairing ticket semantics,
5. same heartbeat semantics,
6. same resume semantics,
7. same relay envelope categories,
8. same stats / fault-rules service intent,
9. same default parameter behavior unless Android-specific hosting requires a documented exception.

### 10. Assembly must support full automation, including dual-screen and Reactotron

Both new packages require automated verification.

The assembly package must additionally support:

1. dual-screen startup verification,
2. visible UI automation,
3. real-service integration,
4. Reactotron DEV connectivity.

## Design Goals

This rebuild should achieve all of the following:

1. preserve the old successful adapter / assembly role split,
2. reuse proven native capabilities instead of rewriting them,
3. rebuild the assembly bootstrap on top of the new kernel / UI architecture,
4. replace the old `LocalWebServer` protocol with a new embedded `topologyHost`,
5. keep dual-process / dual-display behavior,
6. keep Reactotron and RN 0.84 new-architecture support,
7. make both native and assembly layers independently testable,
8. keep package reading and initialization shape much clearer than the old assembly module model.

## Non-goals

This phase does not aim to:

1. redesign business workflows,
2. redesign adapter hardware capability semantics that are already working,
3. collapse native and assembly packages into one package,
4. introduce a third shared bridge package between adapter and assembly,
5. redesign `retail-shell` responsibilities,
6. migrate iOS or Web assembly in this phase.

## Recommended Package Naming

### Adapter package

Directory:

`3-adapter/android/adapter-android-v2`

Published package:

`@next/adapter-android-v2`

Important note:

This is not a kernel runtime module.
It is a native capability package.
So it should not pretend to be a `moduleName`-driven TS runtime module.

### Assembly package

Directory:

`4-assembly/android/mixc-retail-assembly-rn84`

Published package:

`@next/assembly-android-mixc-retail-rn84`

Important note:

This is also not a kernel runtime module.
It is the RN host application package.
It may have app identifiers, release info, launch props, and runtime bootstrap code, but it should not be modeled as another old-style kernel module.

## Preserved Split and Responsibilities

## 1. `adapter-android-v2`

### Positioning

This package is the reusable Android-native capability layer.

It owns:

1. Android-native managers,
2. Android services,
3. capability models and interfaces,
4. independent native diagnostics app,
5. embedded native `topologyHost`.

It does not own:

1. React Native,
2. TurboModule specs,
3. JS runtime bootstrap,
4. `createKernelRuntimeApp`,
5. business runtime composition.

### Internal structure

The package keeps the same top-level split as `adapterPure`:

1. `adapter-lib`
2. `dev-app`

That split is already good and should be inherited.

### Capability reuse policy

The following old areas should be reused first, then improved only when there is a concrete reason:

1. `device`
2. `connector`
3. `logger`
4. `scripts`
5. `appcontrol`
6. `camera`
7. native storage helpers when still useful

### `topologyHost` replaces old `LocalWebServer`

The old `LocalWebServer` area is rebuilt into a native `topologyHost` subsystem.

That subsystem lives inside `adapter-lib`, not in `assembly`.

Its recommended responsibility split is:

1. `TopologyHostManager`
2. `TopologyHostService`
3. `TopologyHostServer`
4. HTTP route handlers
5. WS session / heartbeat / relay handling
6. topology host diagnostics

The old `LocalWebServerManager` / `LocalWebServerService` lifecycle ideas may be reused, but the internal protocol must be reimplemented against `dual-topology-host`.

### `topologyHost` protocol parity requirements

The Android native service must mirror the mock host’s public service surface:

#### HTTP

1. `GET {basePath}/health`
2. `GET {basePath}/stats`
3. `POST {basePath}/tickets`
4. `PUT {basePath}/fault-rules`

#### WebSocket

1. `WS {basePath}/ws`

#### Incoming / outgoing message categories

1. `__host_heartbeat`
2. `__host_heartbeat_ack`
3. `node-hello`
4. `node-hello-ack`
5. `resume-begin`
6. `resume-complete`
7. `command-dispatch`
8. `command-event`
9. `projection-mirror`
10. `request-lifecycle-snapshot`
11. `state-sync-summary`
12. `state-sync-diff`
13. `state-sync-commit-ack`

#### Runtime behavior

1. pairing ticket issuance
2. session tracking
3. node hello processing
4. heartbeat timeout processing
5. relay queueing
6. offline buffering until resume is completed
7. fault-rule replacement
8. stats reporting

#### Default parameter behavior

The Android implementation should inherit the same baseline semantics as:

[dualTopologyHostServerParameters](/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src/supports/parameters.ts)

That includes:

1. default port
2. default base path
3. heartbeat interval
4. heartbeat timeout
5. default ticket expiry

If Android hosting requires different defaults, that must be treated as an explicit design decision, not an accidental drift.

### `dev-app`

`dev-app` remains a first-class validation shell.

It should evolve from “adapter capability demo app” into “native capability + topology host verification app”.

It should verify:

1. device
2. connector
3. logger
4. scripts
5. app control
6. topology host start / stop / status / stats
7. topology host ticket issuance
8. topology host fault-rule replacement
9. topology host loopback connectivity smoke

This lets native issues be isolated before RN assembly is involved.

## 2. `mixc-retail-assembly-rn84`

### Positioning

This package is the RN 0.84 bare host application.

It owns:

1. RN application shell,
2. Android app project,
3. dual-display startup / restart orchestration,
4. TurboModule registration,
5. JS launch props bootstrap,
6. `platformPorts` assembly for the new kernel runtime,
7. runtime composition with `1-kernel` and `2-ui`.

It does not own:

1. low-level Android hardware capability implementation,
2. topology host protocol implementation,
3. business feature definitions,
4. old-style global manager registration architecture.

### Native-side responsibilities

The assembly package must preserve the old successful native host responsibilities from `mixc-retail-rn84v2`:

1. `MainApplication`
2. `MainActivity`
3. `SecondaryActivity`
4. startup overlay
5. delayed secondary launch
6. secondary process shutdown / ACK
7. controlled restart
8. launch options generation
9. startup audit logging

These are already proven and should be inherited structurally.

### JS-side responsibilities

The JS side must be redesigned around the new runtime architecture.

The new bootstrap rule is:

1. do not recreate the old `ApplicationManager` model,
2. do not create another old-style assembly module,
3. build a clear app bootstrap around `createKernelRuntimeApp(...)`.

### Recommended JS bootstrap shape

The assembly package should have a very explicit application entry surface:

1. parse native launch props,
2. resolve display context,
3. build platform ports,
4. configure dev tooling,
5. create runtime app,
6. start runtime,
7. render React root.

Recommended file intent:

1. `src/application/createApp.ts`
2. `src/application/createRuntime.ts`
3. `src/application/resolveLaunchProps.ts`
4. `src/application/configureDevtools.ts`
5. `src/platform-ports/*`
6. `src/turbomodules/*`

The names may be adjusted during implementation, but the structure must stay explicit and readable.

## Assembly-to-Adapter relationship

The relationship should stay clean:

1. `adapter-android-v2` exports native capabilities,
2. `mixc-retail-assembly-rn84` references `adapter-lib` as Android source dependency,
3. assembly creates TurboModules around those native managers,
4. assembly creates TS wrappers around TurboModules,
5. assembly injects those wrappers as `platformPorts` or app bootstrap utilities.

That means the assembly package is a bridge and host, not a second native capability implementation.

## `topologyHost` Integration Strategy

## 1. Native ownership

The full `topologyHost` implementation lives in `adapter-android-v2`.

The assembly package must not reimplement:

1. HTTP route logic,
2. WS relay logic,
3. pairing ticket semantics,
4. resume sequencing,
5. host heartbeat logic.

### 2. TurboModule bridge ownership

Assembly owns the RN exposure layer.

It should provide a `TopologyHostTurboModule` that exposes lifecycle and diagnostics operations required by JS / DEV tooling, such as:

1. start host
2. stop host
3. get host status
4. get host stats
5. replace fault rules

The host protocol itself still runs through real HTTP / WS endpoints.

### 3. Runtime usage rule

Both primary and secondary JS runtimes should talk to the embedded host through the same real loopback protocol model, not through private in-memory shortcuts.

That means:

1. ticket issuance should still follow the host API contract,
2. WebSocket relay should still go through the host socket endpoint,
3. testing should exercise the real topology protocol path even on-device.

This keeps the embedded host behavior aligned with the Node mock host and avoids “Android-only shortcut behavior”.

## Launch Props and Dual-Screen Model

The new assembly should preserve the old launch prop model because it already matches the product:

1. `deviceId`
2. `screenMode`
3. `displayCount`
4. `displayIndex`
5. `isEmulator`

These remain the native-to-JS bootstrap input surface.

The dual-process / dual-runtime model also remains:

1. primary display in main process,
2. secondary display in `:secondary` process,
3. separate JS runtime per display,
4. restart must fully rebuild both runtimes.

This is still required for the future update / restart behavior and should not be weakened.

## Reactotron Strategy

The old Reactotron behavior is worth preserving.

The new assembly should continue to:

1. keep DEV-only Reactotron setup,
2. derive host from package configuration,
3. derive client name from `displayIndex + deviceId`,
4. allow primary and secondary runtime sessions to be distinguished clearly.

This should be built around the old successful pattern from:

[reactotronConfig.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/4-assembly/android/mixc-retail-rn84v2/src/foundations/reactotronConfig.ts)

## Configuration Inheritance Checklist

The following configuration areas must be reviewed and intentionally inherited into the new packages.

## Adapter package

1. Gradle root setup
2. Kotlin version
3. AGP version
4. compile / target / min SDK
5. Java 17 compatibility
6. AndroidX / Jetifier settings
7. library manifest permissions
8. foreground service declaration
9. camera activity declarations
10. `dev-app` manifest and debug startup config

## Assembly package

1. RN 0.84 scripts
2. `codegenConfig`
3. Metro workspace watch / redirect configuration
4. Babel preset
5. TypeScript config
6. Android root build config
7. `settings.gradle` project wiring to adapter source
8. `newArchEnabled`
9. `hermesEnabled`
10. `ndkVersion`
11. `networkSecurityConfig`
12. `usesCleartextTraffic`
13. `largeHeap`
14. boot splash resources and startup theme
15. dual-activity manifest configuration
16. secondary-process manifest declaration
17. Reactotron host config in `package.json`

The implementation phase should treat this as an explicit migration checklist.

## Testing Strategy

## 1. `adapter-android-v2`

This package needs native-first verification.

Required lanes:

1. Kotlin unit tests for pure logic
2. Android instrumentation tests for service / activity / manager behavior
3. `dev-app` visible automation for capability diagnostics

Key scenarios:

1. connector / device / scripts / logger smoke
2. topology host start / stop lifecycle
3. topology host health endpoint
4. topology host ticket issuance
5. topology host WebSocket handshake
6. topology host heartbeat handling
7. topology host resume / relay buffering
8. topology host fault-rule replacement

## 2. `mixc-retail-assembly-rn84`

This package needs host + runtime + UI verification.

Required lanes:

1. Android build verification
2. codegen verification
3. JS typecheck
4. assembly startup integration tests
5. dual-screen Android instrumentation
6. visible UI automation
7. runtime integration against real mock services
8. Reactotron DEV connectivity smoke

Key scenarios:

1. primary startup
2. secondary delayed launch
3. primary restart
4. secondary shutdown ACK
5. embedded topology host start and connectivity
6. primary and secondary runtime joining the same embedded topology host
7. retail shell rendering on both displays
8. admin / terminal shell startup visibility
9. DEV Reactotron naming and host resolution

## Design Summary

The new design deliberately preserves the old successful split:

1. `adapter-android-v2` is the native capability package,
2. `mixc-retail-assembly-rn84` is the RN host assembly package.

The important redesign is not the split.
It is the replacement of the old `LocalWebServer` protocol model with a native `topologyHost` that is behaviorally aligned with `0-mock-server/dual-topology-host`.

This gives us:

1. reuse where reuse is valuable,
2. redesign where the old protocol model is no longer correct,
3. clearer runtime bootstrap on the new base architecture,
4. no fake shortcut between Android host and topology runtime,
5. better long-term consistency between embedded host and mock host.
