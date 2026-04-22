# UI Base Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `2-ui/2.1-base` on top of `1-kernel/1.1-base` with a cleaner RN-first UI foundation that preserves the old screen-part navigation model, absorbs admin and adapter diagnostics, and introduces an explicit virtual-keyboard policy with strong automated test coverage.

**Architecture:** The rebuild creates four UI base packages: `runtime-react`, `input-runtime`, `admin-console`, and `terminal-console`. `runtime-react` is the React bridge for `ui-runtime-v2`; `input-runtime` owns field controllers and virtual keyboard policy; `admin-console` hosts admin login, topology/device/tools, and adapter diagnostics; `terminal-console` is the TCP-facing activation and connection UI aligned with `tcp-control-runtime-v2`. All production exports stay pure React Native. Expo is isolated to `test-expo/`.

**Tech Stack:** TypeScript, React Native, React, React Redux, Vitest, react-test-renderer, Expo (test-only), `@impos2/kernel-base-ui-runtime-v2`, `@impos2/kernel-base-runtime-shell-v2`, `@impos2/kernel-base-topology-runtime-v2`, `@impos2/kernel-base-tcp-control-runtime-v2`, `@impos2/kernel-base-platform-ports`

---

## File Map

### Workspace / repo root

- Modify: `package.json`
  - Add `2-ui/2.1-base/*` workspace glob.
- Modify: `tsconfig.base.json`
  - Ensure RN and test typing remain compatible with the new UI packages.

### New packages to create

- Create: `2-ui/2.1-base/runtime-react/*`
- Create: `2-ui/2.1-base/input-runtime/*`
- Create: `2-ui/2.1-base/admin-console/*`
- Create: `2-ui/2.1-base/terminal-console/*`

Each package should use the same shape:

- `package.json`
- `tsconfig.json`
- `src/application/createModule.ts`
- `src/application/moduleManifest.ts`
- `src/application/index.ts`
- `src/moduleName.ts`
- `src/index.ts`
- `src/foundations/*`
- `src/hooks/*`
- `src/supports/*`
- `src/ui/*`
- `src/types/*`
- `test/*`
- `test-expo/*`

### Key legacy references

- Read-only reference: `_old_/2-ui/2.1-cores/base/src/ui/moduleScreenParts.ts`
- Read-only reference: `_old_/2-ui/2.1-cores/base/src/ui/variables/index.ts`
- Read-only reference: `_old_/2-ui/2.1-cores/base/src/hooks/useMultiplePress.ts`
- Read-only reference: `_old_/2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx`
- Read-only reference: `_old_/2-ui/2.1-cores/terminal/src/hooks/useDeviceActivate.ts`
- Read-only reference: `_old_/2-ui/2.3-integrations/mixc-retail/src/ui/screens/RootScreen.tsx`

### Key new kernel references

- Read-only reference: `1-kernel/1.1-base/ui-runtime-v2/src/index.ts`
- Read-only reference: `1-kernel/1.1-base/ui-runtime-v2/src/features/commands/index.ts`
- Read-only reference: `1-kernel/1.1-base/runtime-shell-v2/src/index.ts`
- Read-only reference: `1-kernel/1.1-base/topology-runtime-v2/src/index.ts`
- Read-only reference: `1-kernel/1.1-base/tcp-control-runtime-v2/src/index.ts`
- Read-only reference: `1-kernel/1.1-base/platform-ports/src/index.ts`

### Shared testing utilities to create

- Create: `2-ui/2.1-base/runtime-react/test/support/runtimeReactHarness.tsx`
- Create: `2-ui/2.1-base/input-runtime/test/support/inputHarness.tsx`
- Create: `2-ui/2.1-base/admin-console/test/support/adminConsoleHarness.tsx`
- Create: `2-ui/2.1-base/terminal-console/test/support/terminalConsoleHarness.tsx`

These harnesses should:

1. create a runtime app through `createKernelRuntimeApp`
2. install only the minimum kernel + UI modules under test
3. support both selector assertions and rendered component assertions
4. avoid Expo imports

---

## Task 1: Wire the new workspace lane

**Files:**
- Modify: `package.json`
- Test: `package.json`

- [ ] **Step 1: Add the new workspace glob**

Update the `workspaces` array so it includes the new UI base packages:

```json
{
  "workspaces": [
    "0-mock-server/*",
    "_old_/0-mock-server/kernel-server/web",
    "0-mock-server/mock-terminal-platform/*",
    "1-kernel/*",
    "1-kernel/1.1-base/*",
    "_old_/1-kernel/1.1-cores/*",
    "_old_/1-kernel/1.2-modules/*",
    "2-ui/2.1-base/*",
    "_old_/2-ui/2.1-cores/*",
    "_old_/2-ui/2.2-modules/*",
    "_old_/2-ui/2.3-integrations/*",
    "3-adapter/*",
    "3-adapter/android/*",
    "_old_/3-adapter/electron/*",
    "3-adapter/tauri/*",
    "4-assembly/*",
    "4-assembly/android/*",
    "_old_/4-assembly/electron/*"
  ]
}
```

- [ ] **Step 2: Verify Yarn sees the workspace**

Run: `corepack yarn workspaces list | rg '2-ui/2.1-base'`

Expected: no error; the command is ready to list the new path once packages are created.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "Prepare the monorepo for rebuilt UI base packages"
```

---

## Task 2: Scaffold the four UI base packages with a uniform structure

**Files:**
- Create: `2-ui/2.1-base/runtime-react/package.json`
- Create: `2-ui/2.1-base/runtime-react/tsconfig.json`
- Create: `2-ui/2.1-base/runtime-react/src/application/createModule.ts`
- Create: `2-ui/2.1-base/runtime-react/src/application/moduleManifest.ts`
- Create: `2-ui/2.1-base/runtime-react/src/application/index.ts`
- Create: `2-ui/2.1-base/runtime-react/src/moduleName.ts`
- Create: `2-ui/2.1-base/runtime-react/src/index.ts`
- Create: `2-ui/2.1-base/runtime-react/test/tsconfig.json`
- Create: `2-ui/2.1-base/runtime-react/test-expo/README.md`
- Create: `2-ui/2.1-base/input-runtime/package.json`
- Create: `2-ui/2.1-base/input-runtime/tsconfig.json`
- Create: `2-ui/2.1-base/input-runtime/src/application/createModule.ts`
- Create: `2-ui/2.1-base/input-runtime/src/application/moduleManifest.ts`
- Create: `2-ui/2.1-base/input-runtime/src/application/index.ts`
- Create: `2-ui/2.1-base/input-runtime/src/moduleName.ts`
- Create: `2-ui/2.1-base/input-runtime/src/index.ts`
- Create: `2-ui/2.1-base/input-runtime/test/tsconfig.json`
- Create: `2-ui/2.1-base/input-runtime/test-expo/README.md`
- Create: `2-ui/2.1-base/admin-console/package.json`
- Create: `2-ui/2.1-base/admin-console/tsconfig.json`
- Create: `2-ui/2.1-base/admin-console/src/application/createModule.ts`
- Create: `2-ui/2.1-base/admin-console/src/application/moduleManifest.ts`
- Create: `2-ui/2.1-base/admin-console/src/application/index.ts`
- Create: `2-ui/2.1-base/admin-console/src/moduleName.ts`
- Create: `2-ui/2.1-base/admin-console/src/index.ts`
- Create: `2-ui/2.1-base/admin-console/test/tsconfig.json`
- Create: `2-ui/2.1-base/admin-console/test-expo/README.md`
- Create: `2-ui/2.1-base/terminal-console/package.json`
- Create: `2-ui/2.1-base/terminal-console/tsconfig.json`
- Create: `2-ui/2.1-base/terminal-console/src/application/createModule.ts`
- Create: `2-ui/2.1-base/terminal-console/src/application/moduleManifest.ts`
- Create: `2-ui/2.1-base/terminal-console/src/application/index.ts`
- Create: `2-ui/2.1-base/terminal-console/src/moduleName.ts`
- Create: `2-ui/2.1-base/terminal-console/src/index.ts`
- Create: `2-ui/2.1-base/terminal-console/test/tsconfig.json`
- Create: `2-ui/2.1-base/terminal-console/test-expo/README.md`
- Test: `2-ui/2.1-base/*/package.json`

- [ ] **Step 1: Create `runtime-react` package metadata**

Model `package.json` after the kernel base packages, but keep React / React Native as peer dependencies and Expo out of production:

```json
{
  "name": "@impos2/ui-base-runtime-react",
  "version": "1.0.0",
  "description": "React Native bridge for kernel ui-runtime-v2",
  "author": "DexterYang",
  "license": "ISC",
  "exports": {
    ".": "./src/index.ts"
  },
  "react-native": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "build-for-product": "rm -rf dist && tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "type-check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@impos2/kernel-base-platform-ports": "workspace:*",
    "@impos2/kernel-base-runtime-shell-v2": "workspace:*",
    "@impos2/kernel-base-topology-runtime-v2": "workspace:*",
    "@impos2/kernel-base-ui-runtime-v2": "workspace:*",
    "@reduxjs/toolkit": "^2.10.0"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.77",
    "react-redux": "^9.1.0"
  },
  "devDependencies": {
    "@types/node": "^25.0.9",
    "@types/react": "^18.3.0",
    "react-test-renderer": "^19.2.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `input-runtime`, `admin-console`, and `terminal-console` package metadata**

Use the same package style, with dependencies adjusted to the package responsibility:

```json
{
  "name": "@impos2/ui-base-input-runtime",
  "version": "1.0.0",
  "exports": {
    ".": "./src/index.ts"
  },
  "react-native": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "build-for-product": "rm -rf dist && tsc -p tsconfig.json",
    "test": "vitest run",
    "type-check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@impos2/kernel-base-platform-ports": "workspace:*",
    "@impos2/kernel-base-runtime-shell-v2": "workspace:*",
    "@impos2/kernel-base-state-runtime": "workspace:*",
    "@impos2/ui-base-runtime-react": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.77",
    "react-redux": "^9.1.0"
  }
}
```

```json
{
  "name": "@impos2/ui-base-admin-console",
  "dependencies": {
    "@impos2/kernel-base-platform-ports": "workspace:*",
    "@impos2/kernel-base-topology-runtime-v2": "workspace:*",
    "@impos2/kernel-base-tcp-control-runtime-v2": "workspace:*",
    "@impos2/ui-base-input-runtime": "workspace:*",
    "@impos2/ui-base-runtime-react": "workspace:*"
  }
}
```

```json
{
  "name": "@impos2/ui-base-terminal-console",
  "dependencies": {
    "@impos2/kernel-base-platform-ports": "workspace:*",
    "@impos2/kernel-base-tcp-control-runtime-v2": "workspace:*",
    "@impos2/ui-base-input-runtime": "workspace:*",
    "@impos2/ui-base-runtime-react": "workspace:*"
  }
}
```

- [ ] **Step 3: Create shared tsconfig and application entry shells**

Each package should start from the same layout:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": false,
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx"
  },
  "include": ["./src/**/*"],
  "exclude": ["node_modules", "dist", "test", "test-expo"]
}
```

```ts
export const moduleName = '@impos2/ui-base-runtime-react'
```

```ts
import {defineKernelRuntimeModuleManifestV2} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'

export const runtimeReactModuleManifest = defineKernelRuntimeModuleManifestV2({
  moduleName,
  description: 'React bridge for kernel ui runtime',
  stateSliceNames: [],
  commandNames: [],
})
```

```ts
import type {
  KernelRuntimeModuleV2,
  RuntimeModuleContextV2,
  RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
  createRuntimeModuleLifecycleLogger,
  defineKernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {runtimeReactModuleManifest} from './moduleManifest'

export const runtimeReactPreSetup = async (
  context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
  createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (): KernelRuntimeModuleV2 =>
  defineKernelRuntimeModuleV2({
    ...runtimeReactModuleManifest,
    preSetup: runtimeReactPreSetup,
    install(context: RuntimeModuleContextV2) {
      createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
    },
  })
```

- [ ] **Step 4: Create short public `src/index.ts` exports**

Keep the same readable pattern in each package:

```ts
export {moduleName} from './moduleName'
export {createModule} from './application/createModule'
export * from './application'
export * from './foundations'
export * from './hooks'
export * from './supports'
export * from './types'
export * from './ui'
```

- [ ] **Step 5: Create test and test-expo placeholders**

Use simple placeholder files that keep the structure explicit and production-clean:

```md
# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.
```

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": "../../../..",
    "declaration": false,
    "declarationMap": false,
    "noEmit": true
  },
  "include": ["../src/**/*", "./**/*"],
  "exclude": ["../node_modules", "../dist"]
}
```

- [ ] **Step 6: Verify the package skeletons**

Run: `corepack yarn type-check`

Expected: new package structure is picked up; missing implementation errors are acceptable only if the skeleton forgot required exported folders. Fix the skeleton until workspace-level type-check can at least resolve the package entry files.

- [ ] **Step 7: Commit**

```bash
git add 2-ui/2.1-base package.json
git commit -m "Scaffold the new 2-ui base package structure"
```

---

## Task 3: Build the shared test strategy before feature work

**Files:**
- Create: `2-ui/2.1-base/runtime-react/test/support/runtimeReactHarness.tsx`
- Create: `2-ui/2.1-base/input-runtime/test/support/inputHarness.tsx`
- Create: `2-ui/2.1-base/admin-console/test/support/adminConsoleHarness.tsx`
- Create: `2-ui/2.1-base/terminal-console/test/support/terminalConsoleHarness.tsx`
- Create: `2-ui/2.1-base/runtime-react/test/index.ts`
- Create: `2-ui/2.1-base/input-runtime/test/index.ts`
- Create: `2-ui/2.1-base/admin-console/test/index.ts`
- Create: `2-ui/2.1-base/terminal-console/test/index.ts`
- Test: `2-ui/2.1-base/*/test/support/*.tsx`

- [ ] **Step 1: Create the runtime harness contract**

The core harness pattern should look like this:

```ts
import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createPlatformPorts} from '@impos2/kernel-base-platform-ports'

export interface UiTestHarness {
  app: ReturnType<typeof createKernelRuntimeApp>
  runtime: ReturnType<ReturnType<typeof createKernelRuntimeApp>['getRuntime']>
  store: ReturnType<ReturnType<typeof createKernelRuntimeApp>['getStore']>
}

export const createUiTestHarness = async (input: {
  modules: readonly unknown[]
}): Promise<UiTestHarness> => {
  const platformPorts = createPlatformPorts({
    environment: 'test',
    logger: console,
  })

  const app = await createKernelRuntimeApp({
    appId: 'ui-base-test',
    platformPorts,
    modules: input.modules,
  })

  return {
    app,
    runtime: app.getRuntime(),
    store: app.getStore(),
  }
}
```

- [ ] **Step 2: Add rendered harness support**

Use `react-test-renderer` so rendered tests do not require Expo:

```ts
import React from 'react'
import TestRenderer from 'react-test-renderer'
import {Provider} from 'react-redux'

export const renderWithStore = (element: React.ReactElement, store: unknown) =>
  TestRenderer.create(<Provider store={store as never}>{element}</Provider>)
```

- [ ] **Step 3: Re-export per-package test helpers**

Each package test index should stay tiny and explicit:

```ts
export * from './support/runtimeReactHarness'
```

```ts
export * from './support/inputHarness'
```

- [ ] **Step 4: Verify test harness compilation**

Run: `corepack yarn workspaces foreach -Rpt --from '@impos2/ui-base-*' run type-check`

Expected: harnesses compile without Expo and without importing from future business packages.

- [ ] **Step 5: Commit**

```bash
git add 2-ui/2.1-base/*/test
git commit -m "Establish a dual-lane test harness for the rebuilt UI base"
```

---

## Task 4: Implement `runtime-react` foundations and registration model

**Files:**
- Create: `2-ui/2.1-base/runtime-react/src/foundations/defineUiScreenPart.ts`
- Create: `2-ui/2.1-base/runtime-react/src/foundations/defineUiModalPart.ts`
- Create: `2-ui/2.1-base/runtime-react/src/foundations/defineUiAlertPart.ts`
- Create: `2-ui/2.1-base/runtime-react/src/foundations/rendererRegistry.ts`
- Create: `2-ui/2.1-base/runtime-react/src/foundations/defaultParts.ts`
- Create: `2-ui/2.1-base/runtime-react/src/foundations/uiVariables.ts`
- Create: `2-ui/2.1-base/runtime-react/src/foundations/index.ts`
- Create: `2-ui/2.1-base/runtime-react/src/types/parts.ts`
- Modify: `2-ui/2.1-base/runtime-react/src/index.ts`
- Test: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-registration.spec.ts`

- [ ] **Step 1: Define a business-friendly screen part contract**

The screen-part definition should preserve the old authoring feel while translating to kernel definitions:

```ts
import type {ComponentType} from 'react'
import type {UiScreenDefinition} from '@impos2/kernel-base-ui-runtime-v2'

export interface UiScreenPartDefinition<TProps = unknown> {
  definition: UiScreenDefinition<TProps>
  component: ComponentType<TProps>
}

export const defineUiScreenPart = <TProps>(
  input: UiScreenDefinition<TProps> & {
    component: ComponentType<TProps>
  },
): UiScreenPartDefinition<TProps> => ({
  definition: {
    ...input,
    readyToEnter: undefined,
  },
  component: input.component,
})
```

- [ ] **Step 2: Create modal and alert helpers**

Keep business code declarative and string-free outside one helper call:

```ts
export const defineUiModalPart = <TProps>(
  input: Omit<UiScreenDefinition<TProps>, 'containerKey'> & {
    component: ComponentType<TProps>
  },
) =>
  defineUiScreenPart({
    ...input,
    containerKey: 'overlay.modal',
  })
```

```ts
export const defineUiAlertPart = <TProps>(
  input: Omit<UiScreenDefinition<TProps>, 'containerKey'> & {
    component: ComponentType<TProps>
  },
) =>
  defineUiScreenPart({
    ...input,
    containerKey: 'overlay.alert',
  })
```

- [ ] **Step 3: Build a local renderer registry**

The registry should extract definitions for kernel registration and keep component lookup local to RN:

```ts
import type {ComponentType} from 'react'
import type {UiScreenDefinition} from '@impos2/kernel-base-ui-runtime-v2'
import type {UiScreenPartDefinition} from '../types/parts'

export interface UiRendererRegistryEntry {
  rendererKey: string
  component: ComponentType<unknown>
}

export interface UiRendererRegistry {
  registerParts(parts: readonly UiScreenPartDefinition[]): UiScreenDefinition[]
  resolve(rendererKey: string): ComponentType<unknown> | null
}
```

- [ ] **Step 4: Recreate the base defaults**

Add minimal default parts that replace the old `emptyScreen`, `defaultAlert`, and `ssWelComeScreen` concepts:

```ts
export const runtimeReactDefaultParts = {
  emptyScreen: defineUiScreenPart({
    partKey: 'empty-screen',
    rendererKey: 'empty-screen',
    name: 'emptyScreen',
    title: 'Empty Screen',
    description: 'Fallback empty screen',
    screenModes: ['primary', 'secondary'],
    workspaces: ['default'],
    instanceModes: ['standalone', 'master', 'slave'],
    component: EmptyScreen,
  }),
}
```

The welcome screen may be a separate part if secondary-display bootstrap still requires it.

- [ ] **Step 5: Expose root UI variables**

Preserve the old root-container semantics:

```ts
export const uiRuntimeRootVariables = {
  primaryRootContainer: {key: 'primary.root.container'},
  secondaryRootContainer: {key: 'secondary.root.container'},
} as const
```

- [ ] **Step 6: Write the failing registration test**

```ts
import {describe, expect, it} from 'vitest'
import {defineUiScreenPart, createRendererRegistry} from '../../src'

describe('runtime-react registration', () => {
  it('separates kernel definitions from local renderer lookup', () => {
    const part = defineUiScreenPart({
      partKey: 'sample',
      rendererKey: 'sample',
      name: 'sample',
      title: 'Sample',
      description: 'Sample screen',
      screenModes: ['primary'],
      workspaces: ['default'],
      instanceModes: ['standalone'],
      component: () => null,
    })

    const registry = createRendererRegistry()
    const definitions = registry.registerParts([part])

    expect(definitions).toHaveLength(1)
    expect(registry.resolve('sample')).not.toBeNull()
  })
})
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-registration.spec.ts`

Expected: FAIL because the registry helpers are not implemented yet.

- [ ] **Step 8: Implement the minimal code and rerun**

Run: `corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-registration.spec.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add 2-ui/2.1-base/runtime-react
git commit -m "Create the runtime-react screen-part and renderer registration model"
```

---

## Task 5: Implement `runtime-react` root rendering and navigation bridge

**Files:**
- Create: `2-ui/2.1-base/runtime-react/src/ui/components/ScreenContainer.tsx`
- Create: `2-ui/2.1-base/runtime-react/src/ui/components/OverlayHost.tsx`
- Create: `2-ui/2.1-base/runtime-react/src/ui/components/AlertHost.tsx`
- Create: `2-ui/2.1-base/runtime-react/src/ui/components/UiRuntimeRootShell.tsx`
- Create: `2-ui/2.1-base/runtime-react/src/ui/components/index.ts`
- Create: `2-ui/2.1-base/runtime-react/src/ui/index.ts`
- Create: `2-ui/2.1-base/runtime-react/src/hooks/useChildScreenPart.ts`
- Create: `2-ui/2.1-base/runtime-react/src/hooks/useScreenPartsByContainer.ts`
- Create: `2-ui/2.1-base/runtime-react/src/hooks/useUiVariableValue.ts`
- Create: `2-ui/2.1-base/runtime-react/src/hooks/useEditableUiVariable.ts`
- Create: `2-ui/2.1-base/runtime-react/src/hooks/useUiOverlays.ts`
- Create: `2-ui/2.1-base/runtime-react/src/hooks/index.ts`
- Create: `2-ui/2.1-base/runtime-react/src/supports/uiNavigationBridge.ts`
- Create: `2-ui/2.1-base/runtime-react/src/supports/index.ts`
- Test: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-screen-container.spec.tsx`
- Test: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-overlay-host.spec.tsx`
- Test: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-navigation-bridge.spec.ts`

- [ ] **Step 1: Write the screen container test**

```ts
import React from 'react'
import {describe, expect, it} from 'vitest'
import {ScreenContainer} from '../../src'
import {createRuntimeReactHarness, renderWithStore} from '../support/runtimeReactHarness'

describe('ScreenContainer', () => {
  it('renders the current screen component for a container', async () => {
    const harness = await createRuntimeReactHarness()
    const tree = renderWithStore(
      <ScreenContainer containerKey="primary.root.container" />,
      harness.store,
    )

    expect(tree.toJSON()).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-screen-container.spec.tsx`

Expected: FAIL because the root rendering components do not exist yet.

- [ ] **Step 3: Implement `ScreenContainer`, `OverlayHost`, and `AlertHost`**

The rendering model should:

1. read current screen or overlay state from `ui-runtime-v2` selectors
2. resolve the renderer key through the local registry
3. render fallback empty content if no renderer exists
4. never embed business flow logic

```tsx
export const ScreenContainer: React.FC<{containerKey: string}> = ({containerKey}) => {
  const entry = useChildScreenPart(containerKey)
  if (!entry?.Component) {
    return null
  }
  const Component = entry.Component
  return <Component {...(entry.props as object)} />
}
```

- [ ] **Step 4: Implement the navigation bridge**

Keep the semantics close to the old UI usage:

```ts
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'

export const createUiNavigationBridge = (runtime: {
  dispatchCommand: (command: unknown) => Promise<unknown>
}) => ({
  navigateTo: (input: {target: UiScreenPartDefinition; props?: unknown}) =>
    runtime.dispatchCommand(
      uiRuntimeV2CommandDefinitions.showScreen.create({
        definition: input.target.definition,
        props: input.props,
      }),
    ),
  replaceScreen: (input: {target: UiScreenPartDefinition; props?: unknown}) =>
    runtime.dispatchCommand(
      uiRuntimeV2CommandDefinitions.replaceScreen.create({
        definition: input.target.definition,
        props: input.props,
      }),
    ),
})
```

- [ ] **Step 5: Implement `UiRuntimeRootShell`**

The root shell should support:

1. root container rendering
2. one-time modal/alert host mounting
3. integration-owned admin trigger placement
4. primary / secondary root selection without introducing router semantics

- [ ] **Step 6: Rerun the failing tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-screen-container.spec.tsx
corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-overlay-host.spec.tsx
corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-navigation-bridge.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 2-ui/2.1-base/runtime-react
git commit -m "Implement root rendering and navigation compatibility for runtime-react"
```

---

## Task 6: Implement `input-runtime` field controllers and explicit keyboard policy

**Files:**
- Create: `2-ui/2.1-base/input-runtime/src/types/input.ts`
- Create: `2-ui/2.1-base/input-runtime/src/foundations/inputModes.ts`
- Create: `2-ui/2.1-base/input-runtime/src/foundations/inputPolicies.ts`
- Create: `2-ui/2.1-base/input-runtime/src/foundations/inputFieldFactory.ts`
- Create: `2-ui/2.1-base/input-runtime/src/foundations/index.ts`
- Create: `2-ui/2.1-base/input-runtime/src/supports/inputController.ts`
- Create: `2-ui/2.1-base/input-runtime/src/supports/inputPersistence.ts`
- Create: `2-ui/2.1-base/input-runtime/src/supports/index.ts`
- Create: `2-ui/2.1-base/input-runtime/src/hooks/useInputController.ts`
- Create: `2-ui/2.1-base/input-runtime/src/hooks/index.ts`
- Create: `2-ui/2.1-base/input-runtime/src/ui/components/InputRuntimeProvider.tsx`
- Create: `2-ui/2.1-base/input-runtime/src/ui/components/InputField.tsx`
- Create: `2-ui/2.1-base/input-runtime/src/ui/components/NumberInputField.tsx`
- Create: `2-ui/2.1-base/input-runtime/src/ui/components/PinInputField.tsx`
- Create: `2-ui/2.1-base/input-runtime/src/ui/components/VirtualKeyboardOverlay.tsx`
- Create: `2-ui/2.1-base/input-runtime/src/ui/components/index.ts`
- Create: `2-ui/2.1-base/input-runtime/src/ui/index.ts`
- Test: `2-ui/2.1-base/input-runtime/test/scenarios/input-runtime-policy.spec.ts`
- Test: `2-ui/2.1-base/input-runtime/test/scenarios/input-runtime-controller.spec.ts`
- Test: `2-ui/2.1-base/input-runtime/test/scenarios/input-runtime-rendered.spec.tsx`

- [ ] **Step 1: Encode the keyboard rule in one place**

The policy helper should make the rule impossible to forget:

```ts
export type ManagedInputMode =
  | 'system-text'
  | 'system-password'
  | 'system-number'
  | 'virtual-number'
  | 'virtual-pin'
  | 'virtual-amount'
  | 'virtual-activation-code'

export const usesVirtualKeyboard = (mode: ManagedInputMode): boolean =>
  mode.startsWith('virtual-')
```

This is the critical design rule:

1. if mode is `virtual-*`, use the virtual keyboard
2. otherwise use the system keyboard
3. do not infer virtual keyboard from “number” or “PIN” semantics alone

- [ ] **Step 2: Write the failing policy test**

```ts
import {describe, expect, it} from 'vitest'
import {usesVirtualKeyboard} from '../../src'

describe('input policy', () => {
  it('uses system keyboard unless virtual keyboard is explicitly declared', () => {
    expect(usesVirtualKeyboard('system-text')).toBe(false)
    expect(usesVirtualKeyboard('system-number')).toBe(false)
    expect(usesVirtualKeyboard('virtual-pin')).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `corepack yarn workspace @impos2/ui-base-input-runtime vitest run test/scenarios/input-runtime-policy.spec.ts`

Expected: FAIL because the policy helpers do not exist yet.

- [ ] **Step 4: Implement the field controller**

The controller owns truth, not the keyboard overlay:

```ts
export interface InputControllerState {
  value: string
  mode: ManagedInputMode
  persistence: 'transient' | 'recoverable' | 'secure-never-persist'
}

export const createInputController = (initial: InputControllerState) => {
  let state = initial
  return {
    getState: () => state,
    setValue: (value: string) => {
      state = {...state, value}
    },
    applyVirtualKey: (key: string) => {
      if (key === 'backspace') {
        state = {...state, value: state.value.slice(0, -1)}
        return
      }
      state = {...state, value: `${state.value}${key}`}
    },
  }
}
```

- [ ] **Step 5: Implement rendered input components**

The rendered component split should be explicit:

1. `InputField` renders real `TextInput` for `system-*`
2. `NumberInputField` and `PinInputField` use the same controller but may opt into `virtual-*`
3. `VirtualKeyboardOverlay` only emits key actions and never owns field state

- [ ] **Step 6: Add persistence policy tests**

Write tests that prove:

1. `secure-never-persist` fields are never restored
2. `transient` fields do not restore after app recreation
3. only explicitly recoverable non-sensitive fields restore

- [ ] **Step 7: Rerun the package tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-input-runtime vitest run test/scenarios/input-runtime-policy.spec.ts
corepack yarn workspace @impos2/ui-base-input-runtime vitest run test/scenarios/input-runtime-controller.spec.ts
corepack yarn workspace @impos2/ui-base-input-runtime vitest run test/scenarios/input-runtime-rendered.spec.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 2-ui/2.1-base/input-runtime
git commit -m "Implement explicit keyboard policy and field controllers for input-runtime"
```

---

## Task 7: Implement `admin-console` authentication, launcher, and recovery model

**Files:**
- Create: `2-ui/2.1-base/admin-console/src/types/admin.ts`
- Create: `2-ui/2.1-base/admin-console/src/foundations/adminTabs.ts`
- Create: `2-ui/2.1-base/admin-console/src/foundations/launcherDefaults.ts`
- Create: `2-ui/2.1-base/admin-console/src/foundations/index.ts`
- Create: `2-ui/2.1-base/admin-console/src/supports/adminPasswordVerifier.ts`
- Create: `2-ui/2.1-base/admin-console/src/supports/adminPersistence.ts`
- Create: `2-ui/2.1-base/admin-console/src/supports/index.ts`
- Create: `2-ui/2.1-base/admin-console/src/hooks/useAdminLauncher.ts`
- Create: `2-ui/2.1-base/admin-console/src/hooks/useAdminPopupState.ts`
- Create: `2-ui/2.1-base/admin-console/src/hooks/index.ts`
- Create: `2-ui/2.1-base/admin-console/src/ui/modals/AdminPopup.tsx`
- Create: `2-ui/2.1-base/admin-console/src/ui/components/AdminLauncherRegion.tsx`
- Create: `2-ui/2.1-base/admin-console/src/ui/components/index.ts`
- Create: `2-ui/2.1-base/admin-console/src/ui/index.ts`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-password.spec.ts`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-launcher.spec.ts`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-recovery.spec.ts`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-popup-rendered.spec.tsx`

- [ ] **Step 1: Implement the password verifier**

Keep the algorithm in a pure helper, not inside the component:

```ts
export const createAdminPasswordVerifier = (input: {
  deviceIdProvider: () => string
  nowProvider?: () => Date
}) => {
  const nowProvider = input.nowProvider ?? (() => new Date())

  return {
    verify(password: string): boolean {
      const now = nowProvider()
      return [-1, 0, 1].some((offset) => {
        const candidate = new Date(now)
        candidate.setHours(candidate.getHours() + offset)
        const raw = `${input.deviceIdProvider()}${formatHour(candidate)}`
        return deriveSixDigitPassword(raw) === password
      })
    },
  }
}
```

`formatHour(candidate)` must generate `YYYYMMDDHH`.

- [ ] **Step 2: Write the failing password test**

```ts
import {describe, expect, it} from 'vitest'
import {createAdminPasswordVerifier} from '../../src'

describe('admin password verifier', () => {
  it('accepts current, previous, and next hour windows', () => {
    const verifier = createAdminPasswordVerifier({
      deviceIdProvider: () => 'DEVICE-001',
      nowProvider: () => new Date('2026-04-15T10:30:00+08:00'),
    })

    expect(verifier.verify('000000')).toBeTypeOf('boolean')
  })
})
```

Then replace `000000` with exact expected values after the implementation algorithm is fixed.

- [ ] **Step 3: Implement the repeated-press launcher**

Model it after old `useMultiplePress`, but formalize the API:

```ts
export const useAdminLauncher = (input: {
  enabled: boolean
  requiredPresses?: number
  timeWindowMs?: number
  areaSize?: number
  onTriggered: () => void
}) => {
  const pressTimesRef = useRef<number[]>([])
  const handleTouch = useCallback((event) => {
    if (!input.enabled) return
    const {pageX, pageY} = event.nativeEvent
    if (pageX > (input.areaSize ?? 100) || pageY > (input.areaSize ?? 100)) {
      return
    }
    const now = Date.now()
    pressTimesRef.current = pressTimesRef.current.filter(
      (time) => now - time < (input.timeWindowMs ?? 3000),
    )
    pressTimesRef.current.push(now)
    if (pressTimesRef.current.length >= (input.requiredPresses ?? 10)) {
      pressTimesRef.current = []
      input.onTriggered()
    }
  }, [input])
  return {onTouchEnd: handleTouch, onClick: handleTouch}
}
```

- [ ] **Step 4: Implement minimal recovery**

Persist only:

1. selected admin tab
2. latest adapter diagnostic summary
3. latest diagnostic timestamp

Do not persist:

1. login session
2. entered password
3. ongoing test stream

- [ ] **Step 5: Build the popup shell**

The popup should:

1. show login view first
2. swap into the tool panel after successful verification
3. expose selected tab state
4. accept injected sections so adapter diagnostics can be merged in later without giant component files

- [ ] **Step 6: Rerun the tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-password.spec.ts
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-launcher.spec.ts
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-recovery.spec.ts
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-popup-rendered.spec.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 2-ui/2.1-base/admin-console
git commit -m "Implement admin authentication, launcher behavior, and recovery rules"
```

---

## Task 8: Absorb adapter diagnostics into `admin-console`

**Files:**
- Create: `2-ui/2.1-base/admin-console/src/supports/adapterDiagnostics.ts`
- Create: `2-ui/2.1-base/admin-console/src/supports/adapterScenarioCatalog.ts`
- Create: `2-ui/2.1-base/admin-console/src/ui/screens/AdapterDiagnosticsScreen.tsx`
- Create: `2-ui/2.1-base/admin-console/src/ui/screens/index.ts`
- Modify: `2-ui/2.1-base/admin-console/src/ui/modals/AdminPopup.tsx`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-adapter-diagnostics.spec.ts`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-adapter-diagnostics-rendered.spec.tsx`

- [ ] **Step 1: Create a normalized diagnostics result model**

```ts
export interface AdapterDiagnosticResult {
  adapterKey: string
  scenarioKey: string
  status: 'idle' | 'running' | 'passed' | 'failed'
  startedAt: number
  completedAt?: number
  summary: string
  details?: string
  artifacts?: readonly string[]
}
```

- [ ] **Step 2: Create the one-click execution helper**

This helper should accept injected adapter test runners from the host environment:

```ts
export const runAdapterDiagnostics = async (input: {
  scenarios: readonly {adapterKey: string; scenarioKey: string; run: () => Promise<AdapterDiagnosticResult>}[]
}) => Promise.all(input.scenarios.map((scenario) => scenario.run()))
```

- [ ] **Step 3: Write the failing diagnostics test**

```ts
import {describe, expect, it} from 'vitest'
import {runAdapterDiagnostics} from '../../src'

describe('adapter diagnostics', () => {
  it('aggregates single and all-adapter runs into a stable summary model', async () => {
    const results = await runAdapterDiagnostics({
      scenarios: [
        {
          adapterKey: 'printer',
          scenarioKey: 'ping',
          run: async () => ({
            adapterKey: 'printer',
            scenarioKey: 'ping',
            status: 'passed',
            startedAt: 1,
            completedAt: 2,
            summary: 'ok',
          }),
        },
      ],
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe('passed')
  })
})
```

- [ ] **Step 4: Integrate the diagnostics view into the admin popup**

Do not revive `adapter-test` as a standalone package.
Add one admin tab dedicated to:

1. adapter detail status
2. one-click test all
3. per-adapter scenario run
4. summary display

- [ ] **Step 5: Rerun the tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-adapter-diagnostics.spec.ts
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-adapter-diagnostics-rendered.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 2-ui/2.1-base/admin-console
git commit -m "Fold adapter diagnostics into the rebuilt admin console"
```

---

## Task 9: Implement `terminal-console` against `tcp-control-runtime-v2`

**Files:**
- Create: `2-ui/2.1-base/terminal-console/src/types/terminal.ts`
- Create: `2-ui/2.1-base/terminal-console/src/foundations/terminalScreenParts.ts`
- Create: `2-ui/2.1-base/terminal-console/src/foundations/index.ts`
- Create: `2-ui/2.1-base/terminal-console/src/hooks/useDeviceActivation.ts`
- Create: `2-ui/2.1-base/terminal-console/src/hooks/useTerminalConnectionSummary.ts`
- Create: `2-ui/2.1-base/terminal-console/src/hooks/index.ts`
- Create: `2-ui/2.1-base/terminal-console/src/ui/screens/ActivateDeviceScreen.tsx`
- Create: `2-ui/2.1-base/terminal-console/src/ui/screens/TerminalSummaryScreen.tsx`
- Create: `2-ui/2.1-base/terminal-console/src/ui/screens/index.ts`
- Create: `2-ui/2.1-base/terminal-console/src/ui/index.ts`
- Test: `2-ui/2.1-base/terminal-console/test/scenarios/terminal-console-activation.spec.ts`
- Test: `2-ui/2.1-base/terminal-console/test/scenarios/terminal-console-summary.spec.ts`
- Test: `2-ui/2.1-base/terminal-console/test/scenarios/terminal-console-rendered.spec.tsx`

- [ ] **Step 1: Write the activation hook test**

```ts
import {describe, expect, it} from 'vitest'
import {createTerminalConsoleHarness} from '../support/terminalConsoleHarness'
import {useDeviceActivationModel} from '../../src'

describe('terminal activation model', () => {
  it('maps activation submit into tcp-control-runtime-v2 command dispatch', async () => {
    const harness = await createTerminalConsoleHarness()
    expect(harness).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement the activation model**

Model it after the old `useDeviceActivate`, but update it to the new runtime APIs:

1. use `input-runtime` field controllers for activation code
2. dispatch `tcpControlV2CommandDefinitions.activateTerminal`
3. observe result and selector state from `tcp-control-runtime-v2`
4. never persist the activation code after app destruction

- [ ] **Step 3: Implement terminal summary selectors**

Expose a hook that turns kernel state into UI-friendly text:

```ts
export interface TerminalConnectionSummary {
  status: string
  terminalId?: string
  lastConnectedAt?: number
  lastDisconnectedAt?: number
  errorMessage?: string
}
```

- [ ] **Step 4: Build the screens and screen parts**

Create explicit screen parts for:

1. activation
2. terminal summary

These should still be declared in a single `terminalScreenParts.ts` file so future business packages see the familiar organization.

- [ ] **Step 5: Rerun the tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-terminal-console vitest run test/scenarios/terminal-console-activation.spec.ts
corepack yarn workspace @impos2/ui-base-terminal-console vitest run test/scenarios/terminal-console-summary.spec.ts
corepack yarn workspace @impos2/ui-base-terminal-console vitest run test/scenarios/terminal-console-rendered.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 2-ui/2.1-base/terminal-console
git commit -m "Align the rebuilt terminal UI with tcp-control-runtime-v2"
```

---

## Task 10: Add Expo smoke lanes without polluting production exports

**Files:**
- Create: `2-ui/2.1-base/runtime-react/test-expo/App.tsx`
- Create: `2-ui/2.1-base/runtime-react/test-expo/scenes/index.tsx`
- Create: `2-ui/2.1-base/input-runtime/test-expo/App.tsx`
- Create: `2-ui/2.1-base/input-runtime/test-expo/scenes/index.tsx`
- Create: `2-ui/2.1-base/admin-console/test-expo/App.tsx`
- Create: `2-ui/2.1-base/admin-console/test-expo/scenes/index.tsx`
- Create: `2-ui/2.1-base/terminal-console/test-expo/App.tsx`
- Create: `2-ui/2.1-base/terminal-console/test-expo/scenes/index.tsx`
- Test: `2-ui/2.1-base/*/src/index.ts`

- [ ] **Step 1: Add smoke App files**

Each Expo test shell should import only from the package production surface:

```tsx
import React from 'react'
import {Text, View} from 'react-native'

export default function App() {
  return (
    <View style={{flex: 1}}>
      <Text>ui-base-runtime-react smoke</Text>
    </View>
  )
}
```

- [ ] **Step 2: Verify production entry points stay Expo-free**

Run: `rg -n "from 'expo'|from \"expo\"" 2-ui/2.1-base/*/src`

Expected: no matches.

- [ ] **Step 3: Verify package exports do not expose `test-expo`**

Run: `rg -n "test-expo" 2-ui/2.1-base/*/package.json`

Expected: no matches in `exports`.

- [ ] **Step 4: Commit**

```bash
git add 2-ui/2.1-base/*/test-expo
git commit -m "Add isolated Expo smoke lanes for the rebuilt UI base"
```

---

## Task 11: Add integration-root usage examples and migration notes

**Files:**
- Create: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-root-shell.spec.tsx`
- Create: `2-ui/2.1-base/admin-console/test/scenarios/admin-integration-trigger.spec.tsx`
- Create: `2-ui/2.1-base/runtime-react/src/supports/rootShellExample.ts`
- Create: `2-ui/2.1-base/admin-console/src/supports/integrationGuide.ts`
- Test: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-root-shell.spec.tsx`
- Test: `2-ui/2.1-base/admin-console/test/scenarios/admin-integration-trigger.spec.tsx`

- [ ] **Step 1: Encode the root integration pattern**

Document and test the pattern taken from the old `RootScreen.tsx`:

1. mount one root shell
2. place primary or secondary container inside it
3. attach admin launcher region at root level
4. mount modal / alert hosts once

- [ ] **Step 2: Write a rendered root-shell test**

```ts
import React from 'react'
import {describe, expect, it} from 'vitest'
import {UiRuntimeRootShell} from '../../src'
import {createRuntimeReactHarness, renderWithStore} from '../support/runtimeReactHarness'

describe('UiRuntimeRootShell', () => {
  it('supports root-level admin launcher composition without router semantics', async () => {
    const harness = await createRuntimeReactHarness()
    const tree = renderWithStore(<UiRuntimeRootShell />, harness.store)
    expect(tree.toJSON()).toBeTruthy()
  })
})
```

- [ ] **Step 3: Verify the rendered integration tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-runtime-react vitest run test/scenarios/runtime-react-root-shell.spec.tsx
corepack yarn workspace @impos2/ui-base-admin-console vitest run test/scenarios/admin-integration-trigger.spec.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add 2-ui/2.1-base/runtime-react 2-ui/2.1-base/admin-console
git commit -m "Document and test the rebuilt root shell integration pattern"
```

---

## Task 12: Full verification pass

**Files:**
- Modify: `2-ui/2.1-base/*` as needed from verification findings
- Test: workspace-level commands

- [ ] **Step 1: Run per-package type-check**

Run:

```bash
corepack yarn workspace @impos2/ui-base-runtime-react type-check
corepack yarn workspace @impos2/ui-base-input-runtime type-check
corepack yarn workspace @impos2/ui-base-admin-console type-check
corepack yarn workspace @impos2/ui-base-terminal-console type-check
```

Expected: PASS.

- [ ] **Step 2: Run per-package tests**

Run:

```bash
corepack yarn workspace @impos2/ui-base-runtime-react test
corepack yarn workspace @impos2/ui-base-input-runtime test
corepack yarn workspace @impos2/ui-base-admin-console test
corepack yarn workspace @impos2/ui-base-terminal-console test
```

Expected: PASS.

- [ ] **Step 3: Run workspace-level verification**

Run:

```bash
corepack yarn type-check
corepack yarn test
```

Expected: PASS, or failures only in unrelated legacy packages that already fail on main. If unrelated legacy failures exist, record them separately and rerun targeted checks for the new packages.

- [ ] **Step 4: Manual smoke checklist**

Check all of the following through the `test-expo` apps or equivalent rendered runner:

1. screen switch works without a router
2. overlay open/close works
3. admin trigger requires repeated top-left presses
4. admin login rejects wrong password
5. admin login accepts current/previous/next hour password
6. system input stays system-driven when not explicitly virtual
7. explicit `virtual-*` fields always use the virtual keyboard
8. activation code input does not restore after app recreation
9. selected admin tab does restore when marked recoverable

- [ ] **Step 5: Final commit**

```bash
git add 2-ui/2.1-base package.json
git commit -m "Complete the first rebuild of the 2-ui base foundation"
```

---

## Self-Review

### Spec coverage

Covered requirements:

1. Preserve old screen-part navigation model: Tasks 4, 5, 9, 11
2. Keep kernel React-free: Tasks 2, 4, 5
3. Explicit virtual keyboard rule: Task 6
4. Dual-lane automated testing plus Expo smoke: Tasks 3, 10, 12
5. Minimal persistence: Tasks 6, 7, 9
6. Old admin entry behavior: Tasks 7, 11
7. Dynamic admin password algorithm: Task 7
8. Absorb `adapter-test` into admin console: Task 8
9. Align terminal UI with `tcp-control-runtime-v2`: Task 9
10. Uniform package structure with `createModule.ts`, `moduleName.ts`, `index.ts`, `test/`, `test-expo/`: Task 2

Known deferred scope:

1. Migration of `2-ui/2.2-business/*` is intentionally not in this plan.
2. Visual redesign beyond structural rebuild is intentionally not in this plan.

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders are intentionally left in the task steps.

### Type consistency

Planned canonical names:

1. `createModule`
2. `defineUiScreenPart`
3. `defineUiModalPart`
4. `defineUiAlertPart`
5. `createAdminPasswordVerifier`
6. `useAdminLauncher`
7. `runAdapterDiagnostics`
8. `createUiNavigationBridge`
9. `usesVirtualKeyboard`

These names should be preserved during implementation to avoid drift between tasks.
