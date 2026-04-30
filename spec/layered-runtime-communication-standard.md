# Layered Runtime Communication Standard

## Purpose

This standard defines how the new runtime stack communicates across layers.
It exists to prevent assembly, UI, adapter, or business code from directly
owning behavior that belongs to another layer.

The default is "migrate what should migrate". Missing `platform-ports`,
kernel commands, UI bridges, or adapter helpers are not reasons to keep
business logic in assembly. They are signals that the lower-level contract is
incomplete and must be extended.

The current scope is:

1. `1-kernel/1.1-base`
2. `2-ui/2.1-base`
3. `3-adapter/android/adapter-android-v2`
4. `3-adapter/android/host-runtime-rn84`
5. Product assemblies such as `4-assembly/android/mixc-catering-assembly-rn84`

## Mandatory Reuse Review

Before adding a new feature, package, transport path, state machine, server
adapter, or cross-layer workflow, inspect the existing terminal codebase first.
The review must cover reusable capabilities, established call patterns, naming
conventions, test harnesses, and dependency boundaries in the owning layer and
the lower layers.

New logic must fit the existing architecture instead of creating a parallel
mechanism. Examples:

1. HTTP and WebSocket communication use `transport-runtime`.
2. Kernel state uses `state-runtime`, package slices, and selectors.
3. Cross-package writes use public commands and actors.
4. Platform facts use `platform-ports`.
5. Errors and parameters use package `supports` definitions.
6. Server addresses use server config rather than ad hoc localhost wiring.

If an existing layer lacks the required capability, extend that layer's public
contract. Do not hide the missing capability inside the business package,
assembly, UI component, or mock-specific helper.

## Layer Contract

### Adapter

`3-adapter/android/adapter-android-v2` owns reusable Android-native facts and
capabilities.

Allowed responsibilities:

1. Expose device facts, storage, logging, connector, camera, script executor,
   hot-update primitives, automation host, and topology host native services.
2. Keep native lifecycle and protocol implementation that is independent from a
   specific product assembly.
3. Provide independently testable managers and dev-app verification surfaces.

Not allowed:

1. Product policy such as retail terminal activation, server-space selection,
   UI navigation, or whether a standalone slave should switch screen mode.
2. React Native runtime composition or kernel command orchestration.

### Host Runtime

`3-adapter/android/host-runtime-rn84` owns reusable RN84 Android host runtime
composition. It is product-agnostic infrastructure for native ports, base
runtime modules, topology, TCP/TDP, terminal/admin base consoles, automation,
and RN84 boot wiring.

Allowed responsibilities:

1. Create the generic kernel runtime app from base kernel and base UI runtime
   modules.
2. Expose typed injection points such as `createShellModule` and
   `extraKernelModules` for product assemblies.
3. Own RN84 host mechanics, native bridge bindings, platform-port adapters,
   automation hooks, topology host lifecycle, and TDP restart preparation.

Not allowed:

1. Importing or depending on `1-kernel/1.2-business/*`,
   `2-ui/2.2-business/*`, or product/business integration packages.
2. Owning the list of product business modules, master-data modules, or
   product-specific screens.
3. Encoding product policy such as catering, retail, tenant, mall, brand, menu,
   or store workflows.

### Product Integration Shell

`2-ui/2.3-integration/*-shell` owns product/business runtime composition that
combines business kernel modules, business UI workbenches, and product shell
actors through public commands/selectors. It may expose a single product module
and a product business-module factory for product assemblies to inject into the
host runtime.

Allowed responsibilities:

1. Register product screens, shell actors, and business UI renderer parts.
2. Compose matching `1-kernel/1.2-business/*` and `2-ui/2.2-business/*` modules
   for that product line.
3. Dispatch public business commands during product lifecycle events.

Not allowed:

1. Importing assembly native wrappers or RN84 host implementation details.
2. Mutating business kernel slices directly instead of dispatching public
   commands.
3. Hiding native host policy that belongs in `host-runtime-rn84` or adapter
   ports.

### Assembly

Product assemblies such as `4-assembly/android/mixc-catering-assembly-rn84` own
final product wiring. They should be the thinnest possible product shell, not a
fallback home for missing capabilities in lower layers.

Allowed responsibilities:

1. Wire adapter native capabilities into `platform-ports`.
2. Build the host runtime app with product release info, host launch props,
   and the selected product integration shell.
3. Own RN84 process, activity, bundle resolver, startup, and restart mechanics
   only when those mechanics are product packaging concerns.
4. Provide product-specific configuration values and build/runtime flags.
5. Perform final module wiring by passing the product integration shell and its
   exported business-module factory into host-runtime injection points.

Not allowed:

1. Owning domain decisions that can be represented as kernel commands or actors.
2. Directly opening UI overlays for domain events when a command-mediated UI
   request can express the same behavior.
3. Mutating another kernel package's slice action directly from assembly.
4. Calling native adapter managers from application logic when an existing
   `platform-ports` port or host interface can carry the fact/capability.
5. Keeping reusable host capability logic only because the target
   `platform-ports`, kernel package, UI module, host-runtime package, or adapter
   module does not yet expose the needed contract.
6. Directly importing `1-kernel/1.2-business/*` or `2-ui/2.2-business/*` when a
   product integration shell can expose the composed product module set.

### Kernel

`1-kernel/1.1-base` owns state machines, durable runtime semantics, commands,
actors, selectors, public errors, and public parameters.

Allowed responsibilities:

1. Interpret platform facts provided by `platform-ports`.
2. Decide domain transitions through public commands and actors.
3. Own slice mutations inside the package that defines the slice.
4. Emit interaction requests as commands when a domain transition requires UI
   confirmation.

Not allowed:

1. Import React, React Native, Android APIs, or assembly native wrappers.
2. Decide concrete UI components, renderer parts, visual layout, or product copy.
3. Hard-code emulator, ADB, mock-server, or product address policy.

Hard constraint:

1. `1-kernel/**` must stay React-free. No `react`, `react-native`,
   `react-redux`, JSX/TSX renderer ownership, or concrete UI implementation
   imports are allowed in kernel packages.

### UI Base

`2-ui/2.1-base` owns reusable UI modules, renderers, host-tool abstractions, and
user input translation.

Allowed responsibilities:

1. Render state and host snapshots.
2. Dispatch public commands in response to user actions.
3. Convert command-level interaction requests into `ui-runtime-v2` overlays when
   the module is explicitly the UI bridge for that request.
4. Provide host interfaces such as admin device/log/control/topology tools.

Not allowed:

1. Performing domain transitions by directly mutating kernel state.
2. Mixing UI button handlers with multi-step host/runtime orchestration when a
   module actor command can own the sequence.
3. Calling assembly/native implementation details directly.

## Communication Rules

### Facts Flow Up Through Ports

External facts enter kernel through `platform-ports`.

Examples:

1. Device power changes enter through `DevicePort.addPowerStatusChangeListener`.
2. Hot-update package install primitives enter through `HotUpdatePort`.
3. Script and connector capabilities enter through `ScriptExecutorPort` and
   `ConnectorPort`.

Assemblies may implement these ports, but they must not also own the domain
decision that consumes the fact when the decision belongs to a kernel runtime.

### Decisions Flow Through Commands

Cross-package writes must use public commands.

Rules:

1. A package may dispatch its own slice actions internally.
2. A package must not import another package's slice actions for cross-package
   mutation.
3. If another layer needs to change a kernel package state, add or reuse a
   public command in that package.
4. Use selectors for cross-package reads.

This rule applies equally to assembly, UI, integration shells, and other kernel
packages.

### Kernel And UI Use Commands For Action Communication

`kernel` and `UI` communicate actions through public commands, while UI reads
kernel data through selectors/state.

Rules:

1. UI to kernel writes must dispatch public commands.
2. Kernel to UI interaction requests must emit public request commands such as
   `request-*`.
3. UI rendering and presentation reads must use kernel selectors/state, not
   command responses as the long-lived truth source.
4. UI must not directly import and dispatch another package's slice actions.
5. Kernel must not import or know concrete UI implementations.

### Interaction Requests Are Separate From Execution Commands

If a domain transition requires user confirmation, model it as two steps:

1. A domain package emits a request command, for example
   `requestDisplayModeSwitchConfirmation`.
2. A UI bridge opens the modal and, on user confirmation, dispatches the domain
   execution command, for example `confirmDisplayModeSwitch` or `setDisplayMode`.

Do not overload one command to mean both "show a confirmation UI" and "perform
the state transition".

### UI Renderers Stay Renderers

Renderer packages such as `runtime-react` should register parts and render
overlays/screens. They should not become the owner of domain orchestration.

If a command needs a UI side-effect, prefer one of these patterns:

1. A UI runtime actor in a UI module handles the request command and opens an
   overlay.
2. A generic host/UI bridge module maps the request command to `ui-runtime-v2`
   commands.
3. The renderer component dispatches the final public command only after user
   input.

### Host Operations Use Host Interfaces

Host capabilities used by UI modules must go through explicit host interfaces.

Examples:

1. Admin console uses `AdminDeviceHost`, `AdminLogHost`, `AdminAppControlHost`,
   `AdminConnectorHost`, and `AdminTopologyHost`.
2. UI modules should not import assembly TurboModules.
3. Multi-step admin flows should prefer admin command actors over inline UI
   handler orchestration.

### Thin Assembly Is A Hard Constraint

When a behavior in assembly is useful outside RN84-specific boot mechanics, do
not classify it as "acceptable until reused". Move it to the layer that owns the
concept and add the missing contract there:

1. Native fact or capability missing: extend `platform-ports` and implement it
   in adapter/assembly.
2. Domain decision missing: add a public command and actor in the owning kernel
   package.
3. UI confirmation or progress interaction missing: add a UI bridge module or
   command-mediated overlay flow in `2-ui`.
4. Android-native reusable operation missing: move it into
   `adapter-android-v2` and expose it through a typed TurboModule/port.
5. Product configuration remains: keep only the explicit value selection and
   final wiring in assembly.

### Assembly Can Compose, But Should Not Hide Domain Policy

Assembly may coordinate startup mechanics that cannot exist elsewhere, such as
RN process launch, native loading screens, bundle resolution, and native host
service lifecycle.

When an assembly function starts to:

1. read kernel state,
2. decide a domain transition,
3. open UI,
4. dispatch multiple domain commands,
5. mutate another package's slice directly,

it should be reviewed as a candidate for kernel command/actor or UI bridge
extraction.

## Canonical Example: Standalone Slave Power Display Switch

The target design for power-triggered display switching is:

1. Adapter reports power status changes.
2. Assembly exposes the native listener through
   `platformPorts.device.addPowerStatusChangeListener`.
3. `topology-runtime-v3` subscribes during module install.
4. `topology-runtime-v3` checks topology context and emits a display-switch
   confirmation request command only for `standalone && instanceMode === 'SLAVE'`
   when the power change implies a different display mode.
5. A UI bridge responds to the request command by opening a confirmation modal
   through `ui-runtime-v2`.
6. The modal renderer shows countdown/confirm/cancel.
7. Confirm dispatches the topology execution command.
8. The topology actor performs the display-mode state transition.

This removes the current assembly shortcut where native power events directly
construct a UI overlay and directly include `setDisplayMode` in modal actions.

## Scan Findings And Refactor Candidates

The following candidates were found in the confirmed new-project scope. They are
listed as refactoring candidates, not as immediate bugs.

### Priority A: Violates Command Or Port Boundaries

1. `4-assembly/.../application/topology/assemblyPowerDisplaySwitch.ts`
   - Current shape: assembly consumes power facts, decides topology behavior,
     constructs a runtime-react alert overlay, and embeds topology execution
     commands.
   - Target shape: adapter -> platform port -> topology request command -> UI
     bridge modal -> topology execution command.

2. `4-assembly/.../application/createModule.ts`
   - Current shape: assembly runtime module subscribes to power changes and
     invokes assembly display-switch policy.
   - Target shape: topology-runtime-v3 owns the power listener and emits
     topology commands.

3. `4-assembly/.../application/syncHotUpdateStateFromNativeBoot.ts`
   - Current shape: assembly reads native hot-update markers and directly
     dispatches `tdpHotUpdateActions`.
   - Target shape: tdp-sync-runtime-v2 exposes public commands such as
     `syncHotUpdateCurrentFromBootFacts`, `markHotUpdateBootRolledBack`, or
     `markHotUpdateLoadComplete`. Assembly supplies native facts, kernel owns
     hot-update state mutation.

4. `4-assembly/.../application/reportAppLoadComplete.ts`
   - Current shape: assembly confirms native load complete and directly dispatches
     `tdpHotUpdateActions.markApplied`.
   - Target shape: assembly calls host/load-complete port; tdp-sync-runtime-v2
     command reconciles boot marker/current state.

### Priority B: UI/Host/Domain Orchestration Mixed In One Place

1. `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`
   - Current shape: UI directly calls both runtime commands and topology host
     methods in button handlers, including mixed clear-master logic.
   - Target shape: UI dispatches admin-console commands; admin actors coordinate
     host calls and topology runtime commands.

2. `2-ui/2.1-base/admin-console/src/features/actors/topologyAdminActor.ts`
   - Current shape: scan/import flow is already command-mediated, but the actor
     still reaches into a global host-tools registry and then dispatches topology
     runtime commands.
   - Target shape: acceptable short term, but longer term should make admin host
     dependencies explicit module input or command context rather than global
     registry lookup.

3. `4-assembly/.../application/adminConsoleConfig.ts`
   - Current shape: assembly builds admin host tools and diagnostic scenarios
     directly from native TurboModules while also mapping topology share/import
     behavior to kernel commands.
   - Target shape: split reusable adapter/admin host bridge from product-specific
     policy. Keep only product enablement and server-space choices in assembly.

### Priority C: Must Move After Contract Expansion

1. `4-assembly/.../application/createApp.ts`
   - Current shape: assembly watches topology context, starts/stops native
     topology host, updates topology binding, and dispatches
     `startTopologyConnection`.
   - Target shape: keep RN launch bootstrapping in assembly, but move
     topology-host lifecycle decision, standalone-slave autostart policy, and
     reusable binding-sync behavior behind dedicated topology host ports and
     kernel commands.

2. `4-assembly/.../application/topology/assemblyTopologyHostLifecycle.ts`
   - Current shape: pure decision helper for when native topology host should run.
   - Target shape: move the decision into topology runtime or host-runtime;
     assembly should only pass launch facts and invoke the host capability.

3. `4-assembly/.../application/resolveTopologyLaunch.ts`
   - Current shape: assembly calls native topology host `prepareLaunch`.
   - Target shape: keep only if it remains pure Android launch mechanics with no
     topology policy, state reads, or business branching.

### Priority D: Keep Only Explicit Product Or RN Host Wiring

1. `4-assembly/.../platform-ports/serverSpaceState.ts`
   - Current shape: assembly owns selected server space and mock-terminal-platform
     address override.
   - Target shape: acceptable product/dev policy. If multiple assemblies need it,
     extract a generic server-space host port or integration utility.

2. `4-assembly/.../application/reportTerminalVersion.ts`
   - Current shape: kernel builds version report payload, assembly chooses
     mock-terminal-platform addresses, outbox, emulator fallback, and transport.
   - Target shape: move report enqueue/flush lifecycle into a kernel runtime or
     reusable integration module; keep only address/environment policy and final
     transport wiring in assembly.

3. `4-assembly/.../application/prepareHotUpdateRestart.ts`
   - Current shape: assembly opens a runtime-react hot-update progress modal,
     waits, closes overlay, and then allows restart.
   - Target shape: convert to a hot-update interaction request command plus UI
     bridge. Assembly may still own the final app restart trigger, but not the
     modal orchestration.

4. `4-assembly/.../application/versionReportOutbox.ts`
   - Current shape: assembly uses a dedicated native storage namespace outside
     managed-secondary-gated state storage.
   - Target shape: move to adapter or a reusable integration/runtime helper if
     the outbox semantics are not RN84-specific. Keep in assembly only if the
     queue is strictly tied to RN84 host boot/restart mechanics.

### Priority E: Mostly Clean / No Immediate Refactor

1. `3-adapter/android/adapter-android-v2/adapter-lib`
   - Scan result: mostly pure Android capabilities. No significant product
     policy or RN84-specific orchestration found in adapter-lib.

2. `2-ui/2.1-base/runtime-react`
   - Scan result: mostly renderer registration and UI rendering. This should
     remain a renderer layer; do not add topology-specific actors directly unless
     consciously introducing a UI bridge module.

3. `1-kernel/1.1-base`
   - Scan result: internal slice action dispatches are package-internal and
     generally conform to the command/actor model. The main gap is missing public
     commands for native boot hot-update reconciliation and power-display-switch
     confirmation.

## Migration Map Under The Thin-Assembly Rule

Use this map when deciding where to move current assembly logic.

### Expand `platform-ports`

Add ports or extend existing ports when assembly is holding raw host facts or
host-side reusable operations.

Candidates:

1. Extend `DevicePort` around power facts if topology-runtime-v3 needs normalized
   power-change payload rather than `Record<string, unknown>`.
2. Extend `HotUpdatePort` with explicit boot fact readers such as
   `readActiveMarker`, `readRollbackMarker`, and a load-complete confirmation
   method that returns normalized boot facts instead of opaque records.
3. Add a dedicated topology host port when lifecycle control, status, diagnostics,
   or launch preparation are reused outside a single assembly.
4. Add reusable app-control host capabilities if fullscreen, lock state, loading
   overlay, or restart preconditions are currently expressed only through RN84
   assembly wrappers.

### Add Kernel Public Commands Or Actors

Add commands whenever assembly or UI currently decides domain transitions.

Candidates:

1. `topology-runtime-v3`
   - subscribe to power facts at install time
   - request display-mode switch confirmation
   - confirm or cancel display-mode switch
   - own standalone-slave topology autostart policy
   - eventually own topology-host lifecycle intent if the decision is generic
2. `tdp-sync-runtime-v2`
   - reconcile hot-update current state from boot facts
   - mark rollback from native boot facts
   - confirm load-complete reconciliation from native confirmation result
   - own terminal version report enqueue/flush lifecycle if this is a reusable
     terminal runtime concern

### Add UI Bridge Modules

Add UI bridge flows whenever assembly currently opens overlays for domain-level
interactions.

Candidates:

1. Power display switch confirmation modal bridge.
2. Hot-update restart progress/countdown bridge.
3. Any admin topology confirmation, import/export, or reconnect flow that still
   requires inline UI orchestration instead of command-driven actors.

### Move Reusable Host Bridges Into Adapter Or UI Base

When the logic is reusable host integration rather than product policy, move it
out of assembly.

Candidates:

1. Admin topology host bridge and diagnostics host bridge.
2. Version-report outbox and host storage helper if it is not RN84-only.
3. Topology share payload import/export helper if it becomes common across
   Android assemblies.

### Keep In Assembly Only If All Conditions Hold

A behavior may remain in assembly only if all of the following are true:

1. It is directly about RN84 process/activity/bootstrap/restart mechanics.
2. It does not read kernel state to make a reusable domain decision.
3. It does not mutate another package through foreign slice actions.
4. It does not own a reusable confirmation/progress interaction.
5. It cannot be expressed as a generic host capability or lower-layer contract
   without introducing fake abstraction.

## Review Checklist For Future Changes

Before adding a new feature or moving code, answer these questions:

1. Is this a platform fact? If yes, expose it through `platform-ports`.
2. Is this a domain decision? If yes, put it in a kernel actor/command.
3. Is this a user interaction request? If yes, use a request command and UI
   bridge, not direct overlay construction in assembly.
4. Is this a concrete renderer? If yes, keep it in `2-ui` renderer packages.
5. Is this native capability implementation? If yes, keep it in adapter.
6. Is this product/dev policy? If yes, assembly may own it, but it must remain
   explicit and should not mutate foreign slices directly.
7. Does this write another package's state? If yes, stop and add/use a public
   command instead.
8. Is this only in assembly because lower layers lack the contract? If yes,
   extend the lower layer and migrate it; do not add another assembly shortcut.
