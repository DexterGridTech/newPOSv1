# `2-ui/2.1-base` Rebuild Design

## Background

The current `2-ui/2.1-cores` packages were built on top of the old `1-kernel/1.1-cores` stack.
That stack is no longer the target architecture.

The new target is:

1. `1-kernel/1.1-base/*` remains the only canonical kernel base.
2. `2-ui/2.1-base/*` becomes the new canonical UI base.
3. `2-ui/2.2-business/*` and `2-ui/2.3-integrations/*` will later migrate to the new UI base, but should not depend on old `2.1-cores` packages anymore.

This is not a mechanical migration.
The goal is to understand:

1. what `2-ui/2.1-cores/*` was trying to solve,
2. how the current business UI actually uses those packages,
3. which parts of the old design are still valuable,
4. which parts should be re-designed more cleanly on top of `1-kernel/1.1-base`.

## Hard Constraints

The following are explicit constraints agreed during the design discussion.

### 1. Keep the current navigation model

The new UI base must keep the current screen-part-driven navigation model.

That means the rebuilt architecture must preserve these concepts:

1. screen part registration
2. current screen per container
3. overlay / modal stack
4. generic UI variables
5. multi-display and multi-workspace semantics

This rebuild must not switch to:

1. URL routing
2. browser-style history routing
3. React Navigation stack/tab routers as the core truth source
4. any other navigation mental model that would force business modules to rewrite how they think about UI flow

### 2. Kernel stays React-free

`1-kernel/1.1-base` must continue to avoid React.
All React Native rendering, component registration, focus/input orchestration, and UI interaction logic must live in `2-ui/2.1-base`.

### 3. Input model is explicit virtual keyboard, default system keyboard

The new input architecture must use an explicit keyboard policy:

1. when the program explicitly declares that a field uses the virtual keyboard, the field must use the virtual keyboard
2. when the program does not declare a virtual keyboard, the field must use the system keyboard
3. number, PIN, amount, activation-code, or secure fields do not automatically imply virtual keyboard unless their field definition explicitly requests it
4. the old pseudo-input approach must be removed

### 4. UI testing must be dual-lane

Every new UI base package must support both:

1. headless automated testing with no real rendered UI
2. rendered automated testing with actual component rendering

In addition, Expo-based scenario smoke validation is allowed for test-only environments, but Expo must not leak into the production export surface.

### 4.1 UI automation runtime is the canonical automation lane

All future `2-ui` package testing should progressively converge on `2-ui/2.1-base/ui-automation-runtime` instead of growing package-local ad-hoc automation protocols.

Rules:

1. UI automation scripts should communicate through the shared JSON-RPC protocol exposed by `ui-automation-runtime`.
2. The primary automation path is semantic query + action + wait:
   1. query by stable `testID`, `semanticId`, `role`, `screen`, or text when appropriate
   2. act through `ui.performAction`, `ui.setValue`, `ui.clearValue`, `ui.submit`, or package-approved semantic actions
   3. wait through `wait.forNode`, `wait.forScreen`, `wait.forState`, `wait.forRequest`, or `wait.forIdle`
3. New rendered tests should prefer shared automation helpers such as `renderWithAutomation` over direct `react-test-renderer` tree spelunking when the test is validating user-observable UI behavior.
4. New `test-expo/runAutomation.mjs` scripts should prefer the shared browser automation harness from `ui-automation-runtime/test-expo` over defining another per-package browser protocol.
5. Coordinate clicks, arbitrary DOM traversal, and package-local browser eval helpers are allowed only as temporary escape hatches when no semantic node exists yet.
6. Dynamic script execution must not be used as the normal UI test API; it is reserved for adapter / host escape-hatch diagnostics and must go through the shared script executor interface.
7. Product builds may compile the automation packages, but Product runtime must not start automation hosts, register targets, keep traces, or expose `scripts.execute`.

Authoring implication:

1. Every reusable screen, modal, overlay, alert, input primitive, and high-value business node should expose a stable `testID`.
2. Nodes that automation must query or operate should be represented in the semantic registry by shared helpers or by package-level registration through the automation bridge.
3. Screen changes must clean stale semantic nodes; tests must not rely on nodes from a previous screen remaining queryable.
4. `primary` and `secondary` targets must be treated as independent automation targets. If a test requires both screens, it should explicitly wait/assert both targets.

### 5. UI persistence must stay minimal

UI state persistence is allowed only for the minimum recovery set.

Examples:

1. restore the current workbench container screen
2. restore the selected admin tab
3. restore the latest adapter diagnostic summary

Examples that must not persist:

1. username
2. password
3. PIN
4. transient form drafts by default
5. errors
6. overlays by default
7. animation state
8. current input focus
9. admin logged-in session across app destruction

### 6. Admin entry behavior must remain the same

The admin console must still be opened the same way as the old package:

1. from the root shell
2. via repeated presses in the top-left trigger region
3. using the same general interaction pattern as `useMultiplePress`

The implementation may be refactored and formalized, but the entry behavior must remain consistent with the old product.

### 7. UI layer does not own business orchestration

The UI layer must stay intentionally thin:

1. UI packages may map state to view models
2. UI packages may dispatch user intent commands
3. UI packages may switch screens or overlays according to already-derived state
4. UI packages must not coordinate multi-step business workflows inside React components
5. UI packages must not embed activation, deactivation, recovery, synchronization, or reset orchestration logic in screens or hooks
6. business sequencing belongs in kernel/runtime actors or other non-UI orchestration layers

In practice this means:

1. React components render the current state and emit a command when the user acts
2. screen transitions are driven by `ui-runtime` state and commands
3. if a flow requires “call A, wait for B, then reset C, then route D”, that flow belongs outside the UI layer

### 8. Admin password rule changes

The old fixed password `123456` is replaced by a local dynamic password algorithm:

1. input includes local device ID
2. input includes current local hour
3. hash result is converted to a numeric string
4. the last six digits are used as the admin password
5. validation accepts current hour, previous hour, and next hour

This validation is local-only and does not require networking.

## Design Goals

The rebuild should achieve all of the following:

1. preserve current business UI navigation habits
2. separate React rendering concerns from kernel runtime concerns
3. remove duplicated `base` and `runtime-base` structures
4. absorb `adapter-test` into the admin console
5. align terminal UI with `tcp-control-runtime-v2`
6. support web, Android, and Electron through pure React Native-compatible production exports
7. expose clean package boundaries for future `2-ui/2.2-business` migration
8. make UI behavior testable both headlessly and visually
9. keep package structure and initialization shape consistent across `2-ui`

## Non-goals

The first rebuild phase does not aim to:

1. migrate all `2-ui/2.2-modules` immediately
2. redesign business workflows
3. redesign all UI visuals across the app
4. replace `ui-runtime-v2` kernel state semantics
5. turn admin tooling into a cloud or remote service

## What The Current Codebase Tells Us

### 1. `2-ui/2.1-cores/base` and `runtime-base` are mostly duplicate

Both packages currently contain:

1. the same keyboard contexts
2. the same keyboard hooks
3. the same animation hooks
4. the same modal container ideas
5. similar screen part exports

This duplication is not architectural value.
It should be removed.

### 2. Business UI depends on navigation-style APIs, not on page-router concepts

The current business packages use:

1. `moduleScreenParts.ts`
2. `navigateTo`
3. `openModal`
4. `closeModal`
5. `useChildScreenPart`
6. `useEditableUiVariable`

So the rebuild must preserve these usage patterns, even if the underlying implementation changes.

### 3. The admin popup is currently integration-root-driven

The admin UI is currently triggered from the integration root screen through:

1. a repeated-press gesture handler
2. a root-level `showAdminPopup` state
3. direct rendering of `AdminPopup`

That behavior should remain, but the logic should become a stable reusable launcher capability instead of ad-hoc integration code.

### 4. Terminal UI is operational, not foundational

`2-ui/2.1-cores/terminal` is really a thin UI around terminal activation and terminal connection state.
It maps cleanly to `1-kernel/1.1-base/tcp-control-runtime-v2`.

So it should stay as its own UI console package rather than being merged into a generic admin package.

### 6. Integration shell only owns shell-specific welcome screens

For the future `2-ui/2.3-integration/*` layer, the responsibility split must stay explicit:

1. `terminal-console` owns and registers the reusable activation screen
2. each integration shell owns and registers only its own business / brand welcome screen
3. `RootScreen` is a host shell only, not a business router
4. root container current content must still be switched through `ui-runtime` commands, not by direct `RootScreen` conditional rendering
5. terminal activation success / deactivation / runtime initialize are handled by integration actors that dispatch `ui-runtime` navigation commands
6. shared activation screens must not be duplicated or re-registered by integration packages
7. UI screens only react to state and emit commands; they do not orchestrate activation/deactivation side effects themselves

This preserves the old design advantage:

1. reusable terminal activation UI stays shared
2. each integration keeps its own welcome semantics
3. the true current screen still lives in `ui-runtime`
4. integration shell behavior remains declarative and screen-part-driven

The first rebuilt integration shell follows this rule:

1. `2-ui/2.3-integration/retail-shell` registers `retail.shell.welcome`
2. `2-ui/2.1-base/terminal-console` registers `ui.base.terminal.activate-device`
3. `retail-shell` chooses which registered screen should be in the primary root container by dispatching `replaceScreen`
4. `retail-shell` root UI only hosts `UiRuntimeRootShell`, input runtime shelling, virtual keyboard overlay, and the admin popup launcher
5. the host root may read display mode and device ID for shell concerns, but it must not decide activation-vs-welcome content through React conditionals
6. business restore / reset / activation lifecycle sequencing must stay in runtime actors, not in `RootScreen` or page hooks

### 5. Adapter test is really an operations capability

`adapter-test` is not a standalone base package in spirit.
It is an operator-facing diagnostics tool.
It belongs inside the new admin console.

## Recommended Package Structure

The new UI base should be split into four packages.

All four packages should use the same package skeleton:

1. `src/application/createModule.ts` as the canonical module assembly entry
2. `src/moduleName.ts` for package identity
3. `src/index.ts` as the short public export surface
4. `test/` for headless and rendered automated tests
5. `test-expo/` for visual smoke and scenario validation only

This keeps the package reading experience aligned with the newer `1-kernel/1.1-base/*` style and avoids scattering setup logic across many folders.

## 1. `2-ui/2.1-base/runtime-react`

### Responsibility

This package is the React Native rendering bridge for `ui-runtime-v2`.

It is responsible for:

1. screen part registration helpers
2. local renderer registry
3. screen container rendering
4. overlay host rendering
5. alert host rendering
6. RN-facing navigation and UI variable bridge hooks
7. root shell helpers for primary and secondary display rendering

It is not responsible for:

1. admin business pages
2. terminal activation business pages
3. custom keyboard policy
4. Expo-only runtime logic

### Public Surface

Recommended public exports:

1. `createModule`
2. `defineUiScreenPart`
3. `defineUiModalPart`
4. `defineUiAlertPart`
5. `ScreenContainer`
6. `OverlayHost`
7. `AlertHost`
8. `UiRuntimeRootShell`
9. `useChildScreenPart`
10. `useScreenPartsByContainer`
11. `useUiVariableValue`
12. `useEditableUiVariable`
13. `useUiOverlays`
14. `uiNavigationBridge`

### Key Design Decision

Business developers should still declare a single screen-part object that includes the React component.
Internally, `runtime-react` splits that into:

1. a kernel-facing screen definition for `ui-runtime-v2`
2. a RN renderer registration for local component lookup

This preserves the current development ergonomics while cleaning the architecture.

### Business Authoring Contract

`runtime-react` should deliberately preserve the old authoring feel for future `2-ui/2.2-business/*` packages.

That means business packages should still mostly look like this:

1. `src/ui/screens/*.tsx`
2. `src/ui/modals/*.tsx`
3. `src/ui/moduleScreenParts.ts`
4. `src/ui/variables/index.ts`
5. `src/hooks/useXxx.ts`

`moduleScreenParts.ts` remains the single business-owned assembly point for screen parts.
Business developers should not have to maintain a second renderer registry file or learn a second routing system.

## 2. `2-ui/2.1-base/input-runtime`

### Responsibility

This package owns the input system.

It defines:

1. input field contracts
2. input controller state
3. managed input mode routing
4. custom numeric / PIN keyboard overlays
5. secure input rules
6. field persistence policy declarations

### Input Modes

Recommended standardized input modes:

1. `system-text`
2. `system-password`
3. `system-number`
4. `virtual-number`
5. `virtual-pin`
6. `virtual-amount`
7. `virtual-activation-code`

The important rule is not the semantic field type itself, but the explicit keyboard policy.
If a field definition does not choose a `virtual-*` mode, the runtime must render a real `TextInput` and let the platform provide the system keyboard.

### Key Design Decision

The old pseudo-input model should be removed.

In the rebuilt design:

1. field value truth always lives in the field controller
2. system input uses real `TextInput`
3. managed keyboards emit key actions only
4. keyboard overlays do not own business truth
5. virtual keyboard is opt-in per field and must never be enabled by implicit type guessing

This is much closer to real system keyboard behavior and is easier to reason about and test.

### Public Surface

Recommended public exports:

1. `createModule`
2. `InputRuntimeProvider`
2. `InputField`
3. `NumberInputField`
4. `PinInputField`
5. `useInputController`
6. `InputPersistencePolicy`
7. `ManagedInputMode`

## 3. `2-ui/2.1-base/admin-console`

### Responsibility

This package is the protected local operations console.

It absorbs:

1. old `admin`
2. old `adapter-test`

### Scope

It owns:

1. admin login
2. device status overview
3. local service status
4. topology / instance mode tools
5. terminal connection diagnostics
6. log file browsing
7. adapter detail diagnostics
8. one-click adapter test execution
9. host application controls

### Admin Auth

Admin auth should be implemented as a dedicated local service, not inline in UI component code.

Recommended service:

`createAdminPasswordVerifier()`

Validation logic:

1. build hash input from `deviceId + YYYYMMDDHH`
2. derive numeric password
3. take last six digits
4. accept current hour / previous hour / next hour
5. never persist input password
6. do not restore login session after app destruction

### Adapter Testing

Adapter diagnostics should be modeled as an operational execution center, not only as static info pages.

The package should support:

1. single adapter test
2. one-click all-adapters test
3. scenario-based adapter tests

Standard test result model:

1. `adapterKey`
2. `scenarioKey`
3. `status`
4. `startedAt`
5. `completedAt`
6. `summary`
7. `details`
8. optional `artifacts`

Persist only:

1. latest summary
2. latest timestamp
3. latest failure summary

Do not persist the full transient execution stream.

### Public Surface

Recommended public exports:

1. `createModule`
2. `AdminPopup`
3. `useAdminLauncher`
4. `createAdminPasswordVerifier`
5. `runAdapterDiagnostics`
6. `adminConsoleScreenParts`

## 4. `2-ui/2.1-base/terminal-console`

### Responsibility

This package is the operational terminal-facing console for activation and TCP state.

It should align directly with `tcp-control-runtime-v2`.

### Scope

It owns:

1. activation code input
2. activation flow UI
3. connection state UI
4. terminal summary display
5. retry / failure feedback

It should not own:

1. admin login
2. logs
3. adapter diagnostics
4. instance mode switching

### Public Surface

Recommended public exports:

1. `createModule`
2. `ActivateDeviceScreen`
3. `useDeviceActivation`
4. `terminalConsoleScreenParts`

## Navigation Compatibility Model

The rebuild must preserve the current navigation mental model.

Business packages should still be able to organize code as:

1. `src/ui/screens/*.tsx`
2. `src/ui/modals/*.tsx`
3. `src/ui/moduleScreenParts.ts`
4. `src/ui/variables/index.ts`
5. `src/hooks/useXxx.ts`

And they should still be able to think in terms of:

1. navigate to a target screen part
2. open a modal
3. close a modal
4. read the current child screen of a container
5. read or edit a UI variable

### Compatibility APIs

`runtime-react` should expose bridge APIs whose semantics stay close to the old ones:

1. `uiNavigationBridge.navigateTo({target})`
2. `uiNavigationBridge.replaceScreen({target})`
3. `uiNavigationBridge.openModal({modal})`
4. `uiNavigationBridge.closeModal({modalId})`
5. `uiNavigationBridge.setUiVariables(payload)`
6. `uiNavigationBridge.clearUiVariables(keys)`
7. `useChildScreenPart(containerVariable)`
8. `useEditableUiVariable(variable)`

The underlying implementation changes, but the business developer mental model remains stable.

### Root Composition Rule

The new UI base should not force integrations into a new root composition model.

Integrations should still be able to:

1. mount one root screen component
2. place the primary or secondary container inside it
3. attach the admin trigger region at the root level
4. render modal and alert hosts once near the shell root

So the rebuild modernizes internals, but the integration author still thinks in terms of a simple root shell instead of a router tree.

## Removal Of `readyToEnter`

The rebuilt screen registration model should not include `readyToEnter`.

Reason:

1. it mixes runtime business readiness decisions into static registration
2. it hides screen entry rules in the wrong layer
3. the new architecture should keep screen definitions declarative

If a business flow has entry conditions, it should decide before dispatching a navigation command.

## Admin Entry Design

The admin entry must preserve old behavior.

### Required behavior

1. root-level trigger region
2. repeated presses in the top-left zone
3. same general repeated-press behavior as the old `useMultiplePress`

### Structural improvement

The repeated-press logic should become a stable reusable capability, not integration glue.

Recommended API:

```ts
const launcher = useAdminLauncher({
  enabled: standaloneOnly,
  area: 'top-left',
  requiredPresses: 10,
  timeWindowMs: 3000,
  onTriggered: openAdminConsole,
})
```

This preserves old behavior while making the logic explicit and testable.

The admin console package should only provide the reusable launcher capability and popup content.
The integration root remains the place that decides whether the launcher is mounted, which matches the current product ownership model.

## Testing Strategy

Every `2-ui/2.1-base` package must support two required automated lanes and one optional but recommended smoke lane.

## 1. Headless automated testing

These tests validate state, commands, selectors, recovery semantics, algorithms, and view models without requiring a rendered UI.

Examples:

### `runtime-react`

1. screen registration
2. container screen selection
3. overlay state bridge
4. UI variable bridge
5. renderer fallback behavior
6. display / workspace aware screen resolution

### `input-runtime`

1. field controller state machine
2. managed key action behavior
3. secure field non-persistence
4. recoverable field behavior
5. amount / PIN parsing and formatting

### `admin-console`

1. dynamic admin password verification
2. ±1 hour tolerance
3. launcher trigger logic
4. menu persistence logic
5. adapter diagnostic aggregation
6. one-click test summary logic

### `terminal-console`

1. activation view model
2. activation status mapping
3. retry behavior
4. minimum recovery behavior

## 2. Rendered automated testing

These tests validate React Native component rendering and interaction.

Examples:

1. `ScreenContainer`
2. `OverlayHost`
3. `InputField`
4. `NumberInputField`
5. `PinInputField`
6. `AdminPopup`
7. `TerminalActivateScreen`

Interaction coverage should include:

1. screen switching
2. modal opening and closing
3. repeated-press admin launcher
4. login success and failure
5. managed keyboard input
6. adapter one-click test feedback

## 3. Expo smoke / scenario testing

Expo is allowed only as a test-only rendering lane.

Each package may provide Expo-based smoke scenes for:

1. visual shell validation
2. end-to-end interaction replay
3. platform-behavior smoke verification

But Expo must not leak into the production export surface.

### Export rule

1. `src/index.ts` exports production-only pure RN capabilities
2. `test-expo/*` is test-only
3. Expo dependencies must not be re-exported or required by production consumers
4. production files under `src/` must not import from `expo`
5. package export maps must not expose `test-expo/*`

## Persistence Strategy

The UI base uses minimum recovery persistence.

## General persistence policy categories

Recommended common policy values:

1. `transient`
2. `recoverable`
3. `secure-never-persist`

### Default policy

Most UI input and transient UI behavior should default to `transient`.

### Never persist

1. username
2. password
3. PIN
4. temporary error text
5. loading states
6. keyboard state
7. input focus
8. animation state
9. admin login session

### Restore only when valuable

Examples of valid recovery targets:

1. current screen in a long-lived container
2. selected admin tab
3. latest adapter test summary

### Persistence Implementation Rule

Recoverable UI state should be persisted through the kernel-provided runtime/state facilities that already back `ui-runtime-v2`.
The UI base should not introduce ad-hoc local persistence stores inside React components.

This keeps restart recovery predictable and aligned with the rest of the rebuilt core.

## Minimal Recovery Sets Per Package

### `runtime-react`

Persist:

1. current primary / secondary container screen where recovery is meaningful
2. explicitly recoverable UI variables

Do not persist:

1. transient overlays
2. alerts
3. renderer-local state

### `input-runtime`

Default all fields to transient.

Only explicitly marked non-sensitive recoverable fields may persist.

### `admin-console`

Persist:

1. selected tab
2. latest adapter diagnostic summary
3. latest adapter diagnostic timestamp

Do not persist:

1. password
2. logged-in state
3. transient test execution stream

### `terminal-console`

Prefer kernel runtime state as the main recovery source.

UI-level persistence should stay minimal and should not restore activation code input or transient failures.

## Recommended Directory Structure

Each package should follow the repo-wide UI structure, while keeping Expo test code isolated.

Example:

```text
src/
  application/
  foundations/
  hooks/
  supports/
  ui/
    components/
    screens/
    modals/
  types/
  moduleName.ts
  index.ts
test/
  scenarios/
  helpers/
test-expo/
  app/
  scenes/
```

Inside this structure:

1. `application/` contains module assembly and package preload wiring
2. `foundations/` contains stable UI definitions, helpers, and constants
3. `hooks/` contains React-facing reusable behavior
4. `supports/` contains algorithms and non-visual services
5. `ui/` contains actual RN presentation code
6. `test/` may contain both headless and rendered tests, but must stay automation-only
7. `test-expo/` is never imported by production code

## Future Business Module Migration Shape

Future `2-ui/2.2-business/*` packages should keep a similar authoring experience to the old system:

1. define screen parts in `moduleScreenParts.ts`
2. declare UI variables in `ui/variables`
3. use hooks for business interaction
4. call bridge navigation APIs that feel close to the current ones
5. keep page and modal components in `ui/screens` and `ui/modals`
6. keep business decision logic out of static screen registration objects

This preserves business developer familiarity while upgrading the underlying architecture.

## Recommended Package Names

The new canonical package directories should be:

1. `2-ui/2.1-base/runtime-react`
2. `2-ui/2.1-base/input-runtime`
3. `2-ui/2.1-base/admin-console`
4. `2-ui/2.1-base/terminal-console`

These names are clearer and more professional than keeping the old `base / runtime-base / admin / terminal / adapter-test` split.

## Summary

The rebuilt UI base should:

1. keep the current screen-part navigation model
2. move React rendering concerns into a clear RN bridge layer
3. replace pseudo-input with an explicit virtual-keyboard opt-in input system
4. merge adapter diagnostics into admin operations
5. keep terminal UI as a dedicated TCP-facing console
6. support both headless and rendered automated testing
7. keep Expo strictly test-only
8. persist only the minimum recovery set
9. preserve the old admin entry behavior

This gives `2-ui` a stable, professional architecture that matches the rebuilt `1-kernel/1.1-base` foundation without forcing business modules into a new UI mental model.
