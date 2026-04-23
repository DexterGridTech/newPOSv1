# `kernel-base-ui-runtime-v2` Design

## Background

The legacy [`navigation`](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/navigation) package is not only a navigation package.
It currently owns four different concerns:

1. `ScreenPart` registration and lookup
2. Container current-screen state
3. Modal/overlay stack state
4. Generic UI temporary variables

This direction is correct for the product, because the system is a POS-style multi-screen runtime rather than a URL router.
The main problem is organization: all runtime UI concerns are mixed inside one workspace slice called `uiVariables`.

The goal of this design is to create a new kernel core package that keeps the same responsibility scope as the current package, while improving internal boundaries and command semantics.

## Goals

1. Keep the same responsibility scope as the old `kernel-core-navigation`
2. Preserve the current `ScreenPart`-driven UI orchestration idea
3. Split runtime state into focused slices instead of one mixed `uiVariables` slice
4. Preserve current workspace persistence and master/slave sync behavior
5. Keep the existing global screen registry model
6. Build the new package in the new `1-kernel/1.1-base/*` monorepo structure

## Non-goals

1. Do not replace the current `navigation` package in this phase
2. Do not migrate any `2-ui` package in this phase
3. Do not add browser-style route history or back-stack behavior
4. Do not add async guards or resolvers in this phase
5. Do not redesign screen registration into an app-instance-level registry

## Package Name

Package directory:

`1-kernel/1.1-base/ui-runtime-v2`

Published package name:

`@impos2/kernel-base-ui-runtime-v2`

Module name:

`kernel.core.ui-runtime`

The package is intentionally named `ui-runtime` instead of `navigation` or `screen-runtime`, because it owns both screen-related runtime state and generic UI variable state.

## Scope

The new package owns four responsibilities.

### 1. Screen registry

The package keeps the existing global registration model based on `ScreenPartRegistration`.

Responsibilities:

1. Register screen parts
2. Resolve `componentType` by `partKey`
3. Query candidate screens by `containerKey`
4. Resolve the first `readyToEnter` screen under the current runtime context

Context filters remain:

1. `screenMode`
2. `workspace`
3. `instanceMode`

### 2. Screen runtime

The package owns container current-screen state.

Responsibilities:

1. Set the current screen for a container
2. Replace the current screen for a container
3. Reset a container current-screen state
4. Read current screen state by `containerKey`

This state is separated from generic UI variables.

### 3. Overlay runtime

The package owns modal/overlay stack state.

Responsibilities:

1. Open overlay
2. Close overlay
3. Clear overlays for a display mode
4. Read primary and secondary overlay stacks

This state is separated from both screen state and generic UI variables.

### 4. Generic UI variable runtime

The package keeps generic temporary UI state storage.

Responsibilities:

1. Set UI variables
2. Clear UI variables
3. Read UI variables

This remains a generic key-value store, but it is isolated into its own slice instead of sharing a state bucket with screen and overlay runtime.

## State Design

The package uses workspace slices, because the current system depends on workspace-aware storage and synchronization.

### `screen` slice

State shape:

```ts
type ScreenRuntimeState = Record<string, ValueWithUpdatedAt<ScreenEntry>>
```

`ScreenEntry`:

```ts
type ScreenEntry = {
  partKey: string
  id?: string | null
  containerKey?: string | null
  props?: any
  name: string
  title: string
  description: string
  indexInContainer?: number | null
  source?: string
  operation?: 'show' | 'replace'
}
```

Each top-level key is a `containerKey`.
Each value must be wrapped in `ValueWithUpdatedAt`, because the interconnection sync middleware compares top-level properties and relies on `updatedAt`.

### `overlay` slice

State shape:

```ts
type OverlayRuntimeState = {
  primaryOverlays: ValueWithUpdatedAt<OverlayEntry[]>
  secondaryOverlays: ValueWithUpdatedAt<OverlayEntry[]>
}
```

`OverlayEntry`:

```ts
type OverlayEntry = {
  id: string
  screenPartKey: string
  props?: any
  openedAt: number
}
```

This preserves the current display-mode split, but no longer mixes these stacks with other UI state.

### `uiVariables` slice

State shape:

```ts
type UiVariablesState = Record<string, ValueWithUpdatedAt<any>>
```

This stays generic in this phase.
The package does not attempt to introduce schemas or lifecycle policies yet.

## Persistence And Sync

This package must preserve the operational behavior of the current `navigation` package.

### Persistence

All three slices use `persistToStorage: true`.

The actual storage behavior still follows the application-level rule already implemented in `applicationManager`:

1. Only slices with `persistToStorage: true` are wrapped by `persistReducer`
2. Actual persistence only happens when `config.environment.displayIndex === 0`

This means the new package does not introduce any new persistence mechanism.
It only declares persistence intent on slices, consistent with current architecture.

### Master/slave sync

All three slices are workspace slices and use the same sync policy as the current `navigation` package:

1. `Workspace.MAIN -> SyncType.MASTER_TO_SLAVE`
2. `Workspace.BRANCH -> SyncType.SLAVE_TO_MASTER`

This keeps the current behavior where runtime UI state is synchronized according to workspace direction.

### Batch sync compatibility

All three slices must implement `batchUpdateState`.

Reason:

1. The state sync middleware diffs top-level fields
2. Remote sync writes back using `<slice>/batchUpdateState`
3. Merge logic is timestamp-based via `updatedAt`

Therefore:

1. All remotely synced top-level values must be `ValueWithUpdatedAt`
2. Slice reducers must not store raw values at synced top-level keys

## Command Design

The new package keeps the command-based kernel style, but uses clearer command names.

### Screen commands

1. `showScreen`
2. `replaceScreen`
3. `resetScreen`

The first two both set a container current-screen entry.
This phase keeps behavior minimal.
`replaceScreen` mainly exists to make intent explicit, even if reducer behavior is currently the same as `showScreen`.

### Overlay commands

1. `openOverlay`
2. `closeOverlay`
3. `clearOverlays`

### UI variable commands

1. `setUiVariables`
2. `clearUiVariables`

## Actor Design

The package follows the current command-to-workspace-dispatch pattern.

### Screen actor

Responsibilities:

1. Convert screen commands into workspace slice actions
2. Require a valid `containerKey`
3. Dispatch updates through `dispatchWorkspaceAction`

### Overlay actor

Responsibilities:

1. Resolve current `DisplayMode`
2. Dispatch overlay actions into the correct workspace slice

### UI variable actor

Responsibilities:

1. Dispatch UI variable updates into the correct workspace slice
2. Keep the command behavior aligned with current `navigation`

### Initialize actor

Responsibilities:

1. Register initialization log
2. Keep the module shape aligned with other kernel packages

## Foundation Design

### Registry

The package keeps a global registry map per `ScreenMode`.

This is intentionally preserved based on current project constraints.

### Queries

The package exposes:

1. `registerScreenPart`
2. `getScreenPartComponentType`
3. `getScreenPartReadyToEnter`
4. `getFirstReadyScreenPartByContainerKey`
5. `getScreenPartsByContainerKey`

These preserve the current operating model and make future migration from `navigation` straightforward.

### Helper creators

The package also exposes:

1. `createOverlayScreen`
2. `createAlert`

These mirror current helper usage patterns in `2-ui`.

## Selectors And Hooks

This package will provide selectors for:

1. reading a UI variable
2. reading overlays by display mode
3. reading container current-screen entry

To keep the first implementation focused, React hooks are not required for the kernel runtime itself.
If lightweight hooks are needed to match current usage ergonomics, they can be added as thin wrappers on top of selectors later.

## Relationship With Existing `navigation`

Phase 1 relationship:

1. `ui-runtime` is added in parallel
2. `navigation` remains untouched
3. no `2-ui` package is migrated
4. no compatibility adapter is introduced yet

This keeps risk low and avoids partial migration complexity in the same change.

## Package Structure

The new package should match the existing kernel core package layout:

1. `package.json`
2. `tsconfig.json`
3. `src/index.ts`
4. `src/moduleName.ts`
5. `src/application/modulePreSetup.ts`
6. `src/features/commands/index.ts`
7. `src/features/actors/*`
8. `src/features/slices/*`
9. `src/features/epics/index.ts`
10. `src/features/middlewares/index.ts`
11. `src/foundations/*`
12. `src/selectors/*`
13. `src/hooks/*`
14. `src/supports/*`
15. `src/types/*`
16. `src/generated/packageVersion.ts`

The package does not need to fully populate epics, middlewares, or hooks in phase 1, but the structure should remain consistent with the workspace.

## Implementation Plan For This Phase

Phase 1 implementation includes:

1. create the new package
2. define types and module state augmentation
3. implement global screen registry foundations
4. implement three workspace slices:
   - `screen`
   - `overlay`
   - `uiVariables`
5. implement commands and actors
6. implement minimal selectors
7. export the module and public APIs
8. run targeted type-check for the package

Phase 1 explicitly does not include:

1. migration of any existing consumer
2. deprecation of `navigation`
3. screen history
4. guard/resolver redesign
5. typed UI variable schema system

## Self-review

This design intentionally stays close to the current runtime behavior.

Checked points:

1. No new persistence mechanism is introduced
2. Sync behavior is explicitly preserved
3. Global registry is intentionally retained
4. Package scope matches current `navigation` scope
5. No migration work is mixed into this phase
