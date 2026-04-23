# UI Automation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified `ui-automation-runtime` control plane that powers Web / Expo UI automation, Android assembly automation over ADB, runtime state inspection, and dual-screen debugging without starting anything in Product mode.

**Architecture:** The implementation is split into four layers. `2-ui/2.1-base/ui-automation-runtime` owns the protocol, runtime registry, semantic registry, query / action / wait engines, trace, and Web / Expo helper integrations. `3-adapter/android/adapter-android-v2` adds a localhost socket transport and script-execution bridge only. `4-assembly/android/mixc-retail-assembly-rn84` only wires native transport, target registration, and environment gating. Kernel changes are explicitly minimized to small helper surfaces only when the runtime facade is insufficient.

**Tech Stack:** TypeScript, React Native 0.84, Expo Web test shells, Vitest, Node WebSocket helpers, Kotlin, Android localhost sockets over ADB, existing native script engine, `@impos2/kernel-base-runtime-shell-v2`, `@impos2/kernel-base-platform-ports`, `@impos2/ui-base-runtime-react`

---

## File Map

### New UI base package

- Create: `2-ui/2.1-base/ui-automation-runtime/package.json`
- Create: `2-ui/2.1-base/ui-automation-runtime/index.js`
- Create: `2-ui/2.1-base/ui-automation-runtime/tsconfig.json`
- Create: `2-ui/2.1-base/ui-automation-runtime/vitest.config.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/application/createModule.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/application/createAutomationRuntime.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/application/index.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/protocol.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/targetRegistry.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/semanticRegistry.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/queryEngine.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/actionExecutor.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/waitEngine.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/eventBus.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/automationTrace.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/scriptExecutorAdapter.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/browserAutomationHost.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/webSocketAutomationHost.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/semanticNodeRegistration.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/*.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/test/**/*.spec.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/test-expo/**`

### Android adapter additions

- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationSocketServer.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationSession.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationMessageCodec.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationHostBridge.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationScriptExecutorBridge.kt`
- Modify: `3-adapter/android/adapter-android-v2/adapter-lib/build.gradle`

### Android assembly additions

- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createAutomationRequestDispatcher.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createRuntimeReactAutomationBridge.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/bootstrapRuntime.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`
- Add if needed: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/specs/NativeAutomationTurboModule.ts`
- Add if needed: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/AutomationTurboModule.kt`

### Possible minimal kernel touch points

- Modify only if strictly required: `1-kernel/1.1-base/runtime-shell-v2/src/types/runtime.ts`
- Modify only if strictly required: `1-kernel/1.1-base/runtime-shell-v2/src/application/createKernelRuntimeApp.ts`
- Modify only if strictly required: `1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts`

### Reference packages

- Reference: `2-ui/2.1-base/runtime-react/**`
- Reference: `2-ui/2.1-base/input-runtime/**`
- Reference: `2-ui/2.1-base/admin-console/**`
- Reference: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/scripts.ts`
- Reference: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/scripts/**`

---

## Task 1: Scaffold `ui-automation-runtime` with the same outer package shape as other `2-ui/2.1-base` packages

**Files:**
- Create: `2-ui/2.1-base/ui-automation-runtime/package.json`
- Create: `2-ui/2.1-base/ui-automation-runtime/index.js`
- Create: `2-ui/2.1-base/ui-automation-runtime/tsconfig.json`
- Create: `2-ui/2.1-base/ui-automation-runtime/vitest.config.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/index.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/moduleName.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/application/index.ts`
- Test: `2-ui/2.1-base/ui-automation-runtime/package.json`

- [ ] **Step 1: Write the failing workspace smoke test**

Create `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-package.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'

describe('ui-automation-runtime package shell', () => {
    it('exports a stable moduleName', async () => {
        const pkg = await import('../../src')
        expect(pkg.moduleName).toBe('ui-base-automation-runtime')
    })
})
```

- [ ] **Step 2: Run the test to verify the package does not exist yet**

Run: `corepack yarn vitest run 2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-package.spec.ts`

Expected: FAIL with missing workspace / file errors.

- [ ] **Step 3: Create package metadata using the same shape as sibling base packages**

Create `2-ui/2.1-base/ui-automation-runtime/package.json`:

```json
{
  "name": "@impos2/ui-base-automation-runtime",
  "version": "1.0.0",
  "description": "Unified UI automation and runtime inspection control plane",
  "author": "DexterYang",
  "license": "ISC",
  "exports": {
    ".": "./src/index.ts",
    "./application": "./src/application/index.ts",
    "./supports": "./src/supports/index.ts",
    "./types": "./src/types/index.ts"
  },
  "react-native": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "build-for-product": "rm -rf dist && tsc -p tsconfig.json",
    "web": "EXPO_OFFLINE=1 node ../../../node_modules/expo/bin/cli start --web --localhost",
    "expo:web": "EXPO_OFFLINE=1 node ../../../node_modules/expo/bin/cli start --web --localhost",
    "test-expo": "tsc -p test-expo/tsconfig.json --noEmit && node test-expo/runAutomation.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "type-check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@impos2/kernel-base-platform-ports": "workspace:*",
    "@impos2/kernel-base-runtime-shell-v2": "workspace:*",
    "@impos2/kernel-base-ui-runtime-v2": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.77"
  },
  "devDependencies": {
    "@types/node": "^25.0.9",
    "expo": "~54.0.31",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 4: Create the minimal source shell**

Create `2-ui/2.1-base/ui-automation-runtime/src/moduleName.ts`:

```ts
export const moduleName = 'ui-base-automation-runtime' as const
```

Create `2-ui/2.1-base/ui-automation-runtime/src/application/index.ts`:

```ts
export {}
```

Create `2-ui/2.1-base/ui-automation-runtime/src/index.ts`:

```ts
export * from './moduleName'
export * from './application'
```

Create `2-ui/2.1-base/ui-automation-runtime/index.js`:

```js
module.exports = require('./src')
```

- [ ] **Step 5: Create TS and Vitest configs matching sibling packages**

Create `2-ui/2.1-base/ui-automation-runtime/tsconfig.json`:

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

Create `2-ui/2.1-base/ui-automation-runtime/vitest.config.ts`:

```ts
import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('ui-base-automation-runtime', {
    test: {
        environment: 'node',
        include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
    },
})
```

- [ ] **Step 6: Run the package smoke test**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-package`

Expected: PASS with one passing package-shell test.

- [ ] **Step 7: Run type-check for the new package**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime type-check`

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add 2-ui/2.1-base/ui-automation-runtime
git commit -m "Scaffold the ui automation runtime package shell"
```

---

## Task 2: Define protocol types, session handshake, and target rules before any engine code

**Files:**
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/protocol.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/runtime.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/actions.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/selectors.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/events.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/index.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/protocol.ts`
- Modify: `2-ui/2.1-base/ui-automation-runtime/src/index.ts`
- Test: `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-protocol.spec.ts`

- [ ] **Step 1: Write the failing protocol contract test**

Create `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-protocol.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {
    AUTOMATION_PROTOCOL_VERSION,
    assertValidTarget,
    assertWaitTarget,
    isSideEffectMethod,
} from '../../src/foundations/protocol'

describe('ui automation runtime protocol rules', () => {
    it('pins the protocol version', () => {
        expect(AUTOMATION_PROTOCOL_VERSION).toBe(1)
    })

    it('allows all only for readonly broadcast methods', () => {
        expect(assertValidTarget('runtime.getInfo', 'all')).toBe('all')
        expect(() => assertValidTarget('command.dispatch', 'all')).toThrow(/all target/i)
        expect(() => assertValidTarget('scripts.execute', 'all')).toThrow(/all target/i)
    })

    it('rejects all for wait methods', () => {
        expect(() => assertWaitTarget('all')).toThrow(/wait target/i)
    })

    it('classifies side effect methods', () => {
        expect(isSideEffectMethod('command.dispatch')).toBe(true)
        expect(isSideEffectMethod('scripts.execute')).toBe(true)
        expect(isSideEffectMethod('runtime.getState')).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify protocol helpers are missing**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-protocol`

Expected: FAIL with missing exports from `src/foundations/protocol.ts`.

- [ ] **Step 3: Define the protocol and target types**

Create `2-ui/2.1-base/ui-automation-runtime/src/types/protocol.ts`:

```ts
export type AutomationTarget = 'primary' | 'secondary' | 'host' | 'all'

export type AutomationMethod =
    | 'session.hello'
    | 'runtime.getInfo'
    | 'runtime.getState'
    | 'runtime.selectState'
    | 'runtime.listRequests'
    | 'runtime.getRequest'
    | 'runtime.getCurrentScreen'
    | 'ui.getTree'
    | 'ui.queryNodes'
    | 'ui.getNode'
    | 'ui.getFocusedNode'
    | 'ui.getBounds'
    | 'ui.performAction'
    | 'ui.revealNode'
    | 'ui.scroll'
    | 'ui.setValue'
    | 'ui.clearValue'
    | 'ui.submit'
    | 'wait.forNode'
    | 'wait.forScreen'
    | 'wait.forState'
    | 'wait.forRequest'
    | 'wait.forIdle'
    | 'events.subscribe'
    | 'events.unsubscribe'
    | 'automation.getLastTrace'
    | 'automation.clearTrace'
    | 'command.dispatch'
    | 'scripts.execute'
```

Create `2-ui/2.1-base/ui-automation-runtime/src/types/runtime.ts`:

```ts
import type {AutomationTarget} from './protocol'

export interface SessionHelloResult {
    readonly protocolVersion: number
    readonly capabilities: readonly string[]
    readonly availableTargets: readonly AutomationTarget[]
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly productMode: boolean
    readonly scriptExecutionAvailable: boolean
}
```

- [ ] **Step 4: Implement the protocol guard helpers**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/protocol.ts`:

```ts
import type {AutomationMethod, AutomationTarget} from '../types/protocol'

export const AUTOMATION_PROTOCOL_VERSION = 1 as const

const sideEffectMethods = new Set<AutomationMethod>([
    'command.dispatch',
    'scripts.execute',
    'ui.performAction',
    'ui.revealNode',
    'ui.scroll',
    'ui.setValue',
    'ui.clearValue',
    'ui.submit',
])

const waitMethods = new Set<AutomationMethod>([
    'wait.forNode',
    'wait.forScreen',
    'wait.forState',
    'wait.forRequest',
    'wait.forIdle',
])

export const isSideEffectMethod = (method: AutomationMethod): boolean => sideEffectMethods.has(method)

export const assertWaitTarget = (target: AutomationTarget): Exclude<AutomationTarget, 'all'> => {
    if (target === 'all') {
        throw new Error('wait target does not allow all')
    }
    return target
}

export const assertValidTarget = (
    method: AutomationMethod,
    target: AutomationTarget,
): AutomationTarget => {
    if (waitMethods.has(method)) {
        return assertWaitTarget(target)
    }
    if (target === 'all' && isSideEffectMethod(method)) {
        throw new Error(`all target is not allowed for side-effect method ${method}`)
    }
    return target
}
```

- [ ] **Step 5: Export protocol types from the package**

Create `2-ui/2.1-base/ui-automation-runtime/src/types/index.ts`:

```ts
export * from './protocol'
export * from './runtime'
export * from './actions'
export * from './selectors'
export * from './events'
```

Replace `2-ui/2.1-base/ui-automation-runtime/src/index.ts` with:

```ts
export * from './moduleName'
export * from './application'
export * from './types'
export * from './foundations/protocol'
```

- [ ] **Step 6: Run the protocol test**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-protocol`

Expected: PASS with all protocol guard assertions passing.

- [ ] **Step 7: Run package type-check**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime type-check`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 2-ui/2.1-base/ui-automation-runtime
git commit -m "Define the automation runtime protocol and target rules"
```

---

## Task 3: Build the target registry and session handshake runtime

**Files:**
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/targetRegistry.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/application/createAutomationRuntime.ts`
- Modify: `2-ui/2.1-base/ui-automation-runtime/src/application/index.ts`
- Modify: `2-ui/2.1-base/ui-automation-runtime/src/index.ts`
- Test: `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-target-registry.spec.ts`

- [ ] **Step 1: Write the failing target registry test**

Create `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-target-registry.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createAutomationRuntime} from '../../src/application'

describe('automation target registry', () => {
    it('starts inert until targets are explicitly registered', () => {
        const runtime = createAutomationRuntime({buildProfile: 'test'})
        expect(runtime.hello().availableTargets).toEqual(['host'])
        expect(runtime.hello().productMode).toBe(false)
    })

    it('registers and unregisters primary and secondary independently', () => {
        const runtime = createAutomationRuntime({buildProfile: 'test'})
        const unregisterPrimary = runtime.registerTarget({target: 'primary', runtimeId: 'primary-1'})
        const unregisterSecondary = runtime.registerTarget({target: 'secondary', runtimeId: 'secondary-1'})

        expect(runtime.hello().availableTargets).toEqual(['host', 'primary', 'secondary'])

        unregisterPrimary()
        expect(runtime.hello().availableTargets).toEqual(['host', 'secondary'])

        unregisterSecondary()
        expect(runtime.hello().availableTargets).toEqual(['host'])
    })

    it('does not expose script execution in product mode', () => {
        const runtime = createAutomationRuntime({
            buildProfile: 'product',
            scriptExecutionAvailable: true,
        })

        expect(runtime.hello().productMode).toBe(true)
        expect(runtime.hello().scriptExecutionAvailable).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify runtime creation is missing**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-target-registry`

Expected: FAIL with missing `createAutomationRuntime`.

- [ ] **Step 3: Implement the target registry**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/targetRegistry.ts`:

```ts
import type {AutomationTarget} from '../types/protocol'

export interface AutomationTargetRegistration {
    readonly target: Exclude<AutomationTarget, 'all'>
    readonly runtimeId: string
}

export interface AutomationTargetSnapshot {
    readonly target: Exclude<AutomationTarget, 'all'>
    readonly runtimeId: string
}

export interface AutomationTargetRegistry {
    register(input: AutomationTargetRegistration): () => void
    list(): readonly AutomationTargetSnapshot[]
    has(target: Exclude<AutomationTarget, 'all'>): boolean
    clearTarget(target: Exclude<AutomationTarget, 'all'>): void
}

export const createAutomationTargetRegistry = (): AutomationTargetRegistry => {
    const targets = new Map<Exclude<AutomationTarget, 'all'>, AutomationTargetSnapshot>()
    targets.set('host', {target: 'host', runtimeId: 'host'})

    return {
        register(input) {
            targets.set(input.target, {
                target: input.target,
                runtimeId: input.runtimeId,
            })
            return () => {
                const current = targets.get(input.target)
                if (current?.runtimeId === input.runtimeId) {
                    targets.delete(input.target)
                }
            }
        },
        list() {
            const order: readonly Exclude<AutomationTarget, 'all'>[] = ['host', 'primary', 'secondary']
            return order.flatMap(target => {
                const snapshot = targets.get(target)
                return snapshot ? [snapshot] : []
            })
        },
        has(target) {
            return targets.has(target)
        },
        clearTarget(target) {
            if (target !== 'host') {
                targets.delete(target)
            }
        },
    }
}
```

- [ ] **Step 4: Implement `createAutomationRuntime` and `session.hello`**

Create `2-ui/2.1-base/ui-automation-runtime/src/application/createAutomationRuntime.ts`:

```ts
import {AUTOMATION_PROTOCOL_VERSION} from '../foundations/protocol'
import {
    type AutomationTargetRegistration,
    createAutomationTargetRegistry,
} from '../foundations/targetRegistry'
import type {SessionHelloResult} from '../types/runtime'

export interface CreateAutomationRuntimeOptions {
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly scriptExecutionAvailable?: boolean
}

export interface AutomationRuntime {
    hello(): SessionHelloResult
    registerTarget(input: AutomationTargetRegistration): () => void
}

export const createAutomationRuntime = (
    options: CreateAutomationRuntimeOptions,
): AutomationRuntime => {
    const targetRegistry = createAutomationTargetRegistry()
    const productMode = options.buildProfile === 'product'

    return {
        hello() {
            return {
                protocolVersion: AUTOMATION_PROTOCOL_VERSION,
                capabilities: [
                    'runtime.query',
                    'ui.semanticRegistry',
                    'wait',
                    'trace',
                    ...(productMode || !options.scriptExecutionAvailable ? [] : ['scripts.execute']),
                ],
                availableTargets: targetRegistry.list().map(target => target.target),
                buildProfile: options.buildProfile,
                productMode,
                scriptExecutionAvailable: !productMode && options.scriptExecutionAvailable === true,
            }
        },
        registerTarget(input) {
            if (productMode) {
                return () => {}
            }
            return targetRegistry.register(input)
        },
    }
}
```

- [ ] **Step 5: Export the runtime creation API**

Replace `2-ui/2.1-base/ui-automation-runtime/src/application/index.ts` with:

```ts
export * from './createAutomationRuntime'
```

Ensure `2-ui/2.1-base/ui-automation-runtime/src/index.ts` still exports `./application`.

- [ ] **Step 6: Run the target registry test**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-target-registry`

Expected: PASS.

- [ ] **Step 7: Run package type-check**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime type-check`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 2-ui/2.1-base/ui-automation-runtime
git commit -m "Add target registration and session handshake for automation runtime"
```

---

## Task 4: Implement semantic registry lifecycle with stale-node protection

**Files:**
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/selectors.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/semanticRegistry.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/semanticNodeRegistration.ts`
- Modify: `2-ui/2.1-base/ui-automation-runtime/src/index.ts`
- Test: `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-semantic-registry.spec.ts`

- [ ] **Step 1: Write the failing semantic registry lifecycle test**

Create `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-semantic-registry.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createSemanticRegistry} from '../../src/foundations/semanticRegistry'

describe('semantic registry lifecycle', () => {
    it('removes nodes on unmount', () => {
        const registry = createSemanticRegistry()
        const unregister = registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'node-1',
            testID: 'button.submit',
            visible: true,
            enabled: true,
            availableActions: ['press'],
        })

        expect(registry.queryNodes({target: 'primary', testID: 'button.submit'})).toHaveLength(1)
        unregister()
        expect(registry.queryNodes({target: 'primary', testID: 'button.submit'})).toHaveLength(0)
    })

    it('clears non-persistent nodes when the screen changes', () => {
        const registry = createSemanticRegistry()
        registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'node-1',
            testID: 'home.button',
            visible: true,
            enabled: true,
            availableActions: ['press'],
        })
        registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'global',
            mountId: 'mount-2',
            nodeId: 'node-2',
            testID: 'global.overlay',
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: ['press'],
        })

        registry.clearScreenContext('primary', ['detail', 'global'])

        expect(registry.queryNodes({target: 'primary', testID: 'home.button'})).toHaveLength(0)
        expect(registry.queryNodes({target: 'primary', testID: 'global.overlay'})).toHaveLength(1)
    })

    it('marks old node ids stale after target reset', () => {
        const registry = createSemanticRegistry()
        registry.registerNode({
            target: 'secondary',
            runtimeId: 'secondary-1',
            screenKey: 'welcome',
            mountId: 'mount-1',
            nodeId: 'node-1',
            testID: 'secondary.title',
            visible: true,
            enabled: true,
            availableActions: [],
        })

        registry.clearTarget('secondary')

        expect(registry.getNode('secondary', 'node-1')?.stale).toBe(true)
        expect(registry.queryNodes({target: 'secondary', testID: 'secondary.title'})).toHaveLength(0)
    })
})
```

- [ ] **Step 2: Run the test to verify semantic registry is missing**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-semantic-registry`

Expected: FAIL with missing `createSemanticRegistry`.

- [ ] **Step 3: Define semantic node and selector types**

Create `2-ui/2.1-base/ui-automation-runtime/src/types/selectors.ts`:

```ts
import type {AutomationTarget} from './protocol'

export type AutomationNodeAction =
    | 'press'
    | 'longPress'
    | 'changeText'
    | 'clear'
    | 'submit'
    | 'focus'
    | 'blur'
    | 'scroll'

export interface AutomationNodeBounds {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

export interface AutomationNodeSnapshot {
    readonly target: Exclude<AutomationTarget, 'all' | 'host'>
    readonly runtimeId: string
    readonly screenKey: string
    readonly mountId: string
    readonly nodeId: string
    readonly testID?: string
    readonly semanticId?: string
    readonly role?: string
    readonly text?: string
    readonly value?: unknown
    readonly visible: boolean
    readonly enabled: boolean
    readonly focused?: boolean
    readonly bounds?: AutomationNodeBounds
    readonly availableActions: readonly AutomationNodeAction[]
    readonly persistent?: boolean
    readonly stale?: boolean
}

export interface AutomationNodeQuery {
    readonly target: Exclude<AutomationTarget, 'all' | 'host'>
    readonly testID?: string
    readonly semanticId?: string
    readonly text?: string
    readonly role?: string
    readonly screen?: string
    readonly path?: string
}
```

- [ ] **Step 4: Implement semantic registry lifecycle**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/semanticRegistry.ts`:

```ts
import type {AutomationTarget} from '../types/protocol'
import type {AutomationNodeQuery, AutomationNodeSnapshot} from '../types/selectors'

type SemanticTarget = Exclude<AutomationTarget, 'all' | 'host'>

export interface SemanticRegistry {
    registerNode(node: AutomationNodeSnapshot): () => void
    updateNode(target: SemanticTarget, nodeId: string, patch: Partial<AutomationNodeSnapshot>): void
    queryNodes(query: AutomationNodeQuery): readonly AutomationNodeSnapshot[]
    getNode(target: SemanticTarget, nodeId: string): AutomationNodeSnapshot | undefined
    clearScreenContext(target: SemanticTarget, visibleContextKeys: readonly string[]): void
    clearTarget(target: SemanticTarget): void
}

export const createSemanticRegistry = (): SemanticRegistry => {
    const liveNodes = new Map<string, AutomationNodeSnapshot>()
    const staleNodes = new Map<string, AutomationNodeSnapshot>()

    const keyOf = (target: SemanticTarget, nodeId: string) => `${target}:${nodeId}`

    const markStale = (key: string) => {
        const node = liveNodes.get(key)
        if (!node) {
            return
        }
        liveNodes.delete(key)
        staleNodes.set(key, {...node, stale: true})
    }

    return {
        registerNode(node) {
            const key = keyOf(node.target, node.nodeId)
            liveNodes.set(key, {...node, stale: false})
            staleNodes.delete(key)
            return () => markStale(key)
        },
        updateNode(target, nodeId, patch) {
            const key = keyOf(target, nodeId)
            const node = liveNodes.get(key)
            if (node) {
                liveNodes.set(key, {...node, ...patch, target, nodeId})
            }
        },
        queryNodes(query) {
            return [...liveNodes.values()].filter(node => {
                if (node.target !== query.target) return false
                if (query.testID && node.testID !== query.testID) return false
                if (query.semanticId && node.semanticId !== query.semanticId) return false
                if (query.text && node.text !== query.text) return false
                if (query.role && node.role !== query.role) return false
                if (query.screen && node.screenKey !== query.screen) return false
                return true
            })
        },
        getNode(target, nodeId) {
            const key = keyOf(target, nodeId)
            return liveNodes.get(key) ?? staleNodes.get(key)
        },
        clearScreenContext(target, visibleContextKeys) {
            for (const [key, node] of liveNodes.entries()) {
                if (
                    node.target === target
                    && !node.persistent
                    && !visibleContextKeys.includes(node.screenKey)
                ) {
                    markStale(key)
                }
            }
        },
        clearTarget(target) {
            for (const [key, node] of liveNodes.entries()) {
                if (node.target === target) {
                    markStale(key)
                }
            }
        },
    }
}
```

- [ ] **Step 5: Add registration support helpers**

Create `2-ui/2.1-base/ui-automation-runtime/src/supports/semanticNodeRegistration.ts`:

```ts
import type {SemanticRegistry} from '../foundations/semanticRegistry'
import type {AutomationNodeSnapshot} from '../types/selectors'

export const registerAutomationNode = (
    registry: SemanticRegistry,
    node: AutomationNodeSnapshot,
): (() => void) => registry.registerNode(node)
```

Create `2-ui/2.1-base/ui-automation-runtime/src/supports/index.ts`:

```ts
export * from './semanticNodeRegistration'
```

Update `2-ui/2.1-base/ui-automation-runtime/src/index.ts`:

```ts
export * from './moduleName'
export * from './application'
export * from './types'
export * from './supports'
export * from './foundations/protocol'
export * from './foundations/semanticRegistry'
```

- [ ] **Step 6: Run the semantic registry test**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-semantic-registry`

Expected: PASS.

- [ ] **Step 7: Run package type-check**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime type-check`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 2-ui/2.1-base/ui-automation-runtime
git commit -m "Add semantic registry lifecycle for automation nodes"
```

---

## Task 5: Add query engine, action executor, wait engine, and trace primitives

**Files:**
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/actions.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/types/events.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/queryEngine.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/actionExecutor.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/waitEngine.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/automationTrace.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/foundations/eventBus.ts`
- Test: `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-engines.spec.ts`

- [ ] **Step 1: Write the failing engine test**

Create `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-engines.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createSemanticRegistry} from '../../src/foundations/semanticRegistry'
import {createQueryEngine} from '../../src/foundations/queryEngine'
import {createActionExecutor} from '../../src/foundations/actionExecutor'
import {createWaitEngine} from '../../src/foundations/waitEngine'
import {createAutomationTrace} from '../../src/foundations/automationTrace'

describe('automation query/action/wait engines', () => {
    it('queries nodes and rejects stale action targets', async () => {
        const registry = createSemanticRegistry()
        const trace = createAutomationTrace()
        const queryEngine = createQueryEngine({registry, trace})
        const actionExecutor = createActionExecutor({registry, trace})
        const unregister = registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'submit',
            testID: 'home.submit',
            visible: true,
            enabled: true,
            availableActions: ['press'],
        })

        expect(queryEngine.queryNodes({target: 'primary', testID: 'home.submit'})).toHaveLength(1)
        unregister()

        await expect(actionExecutor.performAction({
            target: 'primary',
            nodeId: 'submit',
            action: 'press',
        })).rejects.toThrow(/STALE_NODE/)
        expect(trace.getLastTrace()?.status).toBe('failed')
    })

    it('waits for idle after quiet window', async () => {
        const trace = createAutomationTrace()
        const waitEngine = createWaitEngine({
            trace,
            quietWindowMs: 5,
            getPendingRequestCount: () => 0,
            getInFlightActionCount: () => 0,
            getInFlightScriptCount: () => 0,
            subscribeToRuntimeEvents: () => () => {},
        })
        const result = await waitEngine.forIdle({target: 'primary', timeoutMs: 100})

        expect(result.ok).toBe(true)
    })
})
```

- [ ] **Step 2: Run the test to verify engines are missing**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-engines`

Expected: FAIL with missing engine modules.

- [ ] **Step 3: Define action and event types**

Create `2-ui/2.1-base/ui-automation-runtime/src/types/actions.ts`:

```ts
import type {AutomationTarget} from './protocol'
import type {AutomationNodeAction} from './selectors'

export interface PerformNodeActionInput {
    readonly target: Exclude<AutomationTarget, 'all' | 'host'>
    readonly nodeId: string
    readonly action: AutomationNodeAction
    readonly value?: unknown
}

export interface AutomationActionResult {
    readonly ok: boolean
    readonly nodeId?: string
    readonly message?: string
}
```

Create `2-ui/2.1-base/ui-automation-runtime/src/types/events.ts`:

```ts
import type {AutomationTarget} from './protocol'

export type AutomationEventTopic =
    | 'runtime.ready'
    | 'runtime.disposed'
    | 'runtime.screenChanged'
    | 'runtime.stateChanged'
    | 'runtime.requestChanged'
    | 'automation.completed'
    | 'host.connectionChanged'
    | 'registry.nodeMounted'
    | 'registry.nodeUnmounted'

export interface AutomationEvent {
    readonly topic: AutomationEventTopic
    readonly target: Exclude<AutomationTarget, 'all'>
    readonly payload: unknown
    readonly createdAt: number
}
```

- [ ] **Step 4: Implement bounded trace history**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/automationTrace.ts`:

```ts
export interface AutomationTraceEntry {
    readonly step: string
    readonly status: 'ok' | 'failed'
    readonly input?: unknown
    readonly output?: unknown
    readonly error?: string
    readonly createdAt: number
}

export interface AutomationTrace {
    record(entry: Omit<AutomationTraceEntry, 'createdAt'>): void
    getLastTrace(): AutomationTraceEntry | undefined
    getTraceHistory(limit?: number): readonly AutomationTraceEntry[]
    clear(): void
}

export const createAutomationTrace = (maxEntries = 50): AutomationTrace => {
    const history: AutomationTraceEntry[] = []

    return {
        record(entry) {
            history.push({
                ...entry,
                createdAt: Date.now(),
            })
            while (history.length > maxEntries) {
                history.shift()
            }
        },
        getLastTrace() {
            return history.at(-1)
        },
        getTraceHistory(limit = maxEntries) {
            return history.slice(Math.max(0, history.length - limit))
        },
        clear() {
            history.length = 0
        },
    }
}
```

- [ ] **Step 5: Implement query and action engines**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/queryEngine.ts`:

```ts
import type {AutomationTrace} from './automationTrace'
import type {SemanticRegistry} from './semanticRegistry'
import type {AutomationNodeQuery} from '../types/selectors'

export const createQueryEngine = (input: {
    readonly registry: SemanticRegistry
    readonly trace: AutomationTrace
}) => ({
    queryNodes(query: AutomationNodeQuery) {
        const nodes = input.registry.queryNodes(query)
        input.trace.record({
            step: 'ui.queryNodes',
            status: 'ok',
            input: query,
            output: {count: nodes.length},
        })
        return nodes
    },
})
```

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/actionExecutor.ts`:

```ts
import type {AutomationTrace} from './automationTrace'
import type {SemanticRegistry} from './semanticRegistry'
import type {AutomationActionResult, PerformNodeActionInput} from '../types/actions'

export const createActionExecutor = (input: {
    readonly registry: SemanticRegistry
    readonly trace: AutomationTrace
}) => ({
    async performAction(action: PerformNodeActionInput): Promise<AutomationActionResult> {
        const node = input.registry.getNode(action.target, action.nodeId)
        if (!node || node.stale) {
            input.trace.record({
                step: 'ui.performAction',
                status: 'failed',
                input: action,
                error: 'STALE_NODE',
            })
            throw new Error('STALE_NODE')
        }
        if (!node.visible || !node.enabled || !node.availableActions.includes(action.action)) {
            input.trace.record({
                step: 'ui.performAction',
                status: 'failed',
                input: action,
                error: 'NODE_NOT_ACTIONABLE',
            })
            throw new Error('NODE_NOT_ACTIONABLE')
        }
        const result = {ok: true, nodeId: action.nodeId}
        input.trace.record({
            step: 'ui.performAction',
            status: 'ok',
            input: action,
            output: result,
        })
        return result
    },
})
```

- [ ] **Step 6: Implement `wait.forIdle` using runtime counters and event subscriptions**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/waitEngine.ts`:

```ts
import type {AutomationTrace} from './automationTrace'
import type {AutomationEvent} from '../types/events'
import type {AutomationTarget} from '../types/protocol'

export interface WaitResult {
    readonly ok: boolean
    readonly blocker?: string
}

export const createWaitEngine = (input: {
    readonly trace: AutomationTrace
    readonly getPendingRequestCount: (target: Exclude<AutomationTarget, 'all'>) => number
    readonly getInFlightActionCount: (target: Exclude<AutomationTarget, 'all'>) => number
    readonly getInFlightScriptCount: (target: Exclude<AutomationTarget, 'all'>) => number
    readonly subscribeToRuntimeEvents: (
        target: Exclude<AutomationTarget, 'all'>,
        handler: (event: AutomationEvent) => void,
    ) => () => void
    readonly quietWindowMs?: number
}) => ({
    async forIdle(options: {
        readonly target: Exclude<AutomationTarget, 'all'>
        readonly timeoutMs: number
    }): Promise<WaitResult> {
        const quietWindowMs = input.quietWindowMs ?? 300
        const startedAt = Date.now()
        let lastActivityAt = startedAt
        let lastBlocker = 'unknown'

        const unsubscribe = input.subscribeToRuntimeEvents(options.target, event => {
            if (
                event.topic === 'runtime.stateChanged'
                || event.topic === 'runtime.screenChanged'
                || event.topic === 'runtime.requestChanged'
            ) {
                lastActivityAt = Date.now()
            }
        })

        try {
            while (Date.now() - startedAt < options.timeoutMs) {
                const pendingRequests = input.getPendingRequestCount(options.target)
                const inFlightActions = input.getInFlightActionCount(options.target)
                const inFlightScripts = input.getInFlightScriptCount(options.target)

                if (pendingRequests === 0 && inFlightActions === 0 && inFlightScripts === 0) {
                    if (Date.now() - lastActivityAt >= quietWindowMs) {
                        const result = {ok: true}
                        input.trace.record({
                            step: 'wait.forIdle',
                            status: 'ok',
                            input: options,
                            output: result,
                        })
                        return result
                    }
                    lastBlocker = 'quiet-window'
                } else if (pendingRequests > 0) {
                    lastBlocker = `pending-requests:${pendingRequests}`
                } else if (inFlightActions > 0) {
                    lastBlocker = `in-flight-actions:${inFlightActions}`
                } else {
                    lastBlocker = `in-flight-scripts:${inFlightScripts}`
                }

                await new Promise(resolve => setTimeout(resolve, 25))
            }

            const result = {ok: false, blocker: lastBlocker}
            input.trace.record({
                step: 'wait.forIdle',
                status: 'failed',
                input: options,
                output: result,
                error: `WAIT_FOR_IDLE_TIMEOUT:${lastBlocker}`,
            })
            return result
        } finally {
            unsubscribe()
        }
    },
})
```

- [ ] **Step 7: Implement event bus callbacks, unsubscribe, and session cleanup**

Create `2-ui/2.1-base/ui-automation-runtime/src/foundations/eventBus.ts`:

```ts
import type {AutomationEvent, AutomationEventTopic} from '../types/events'
import type {AutomationTarget} from '../types/protocol'

export interface AutomationSubscription {
    readonly id: string
    readonly target?: Exclude<AutomationTarget, 'all'>
    readonly topic?: AutomationEventTopic
    readonly sessionId?: string
}

export const createAutomationEventBus = () => {
    const subscriptions = new Map<string, {
        subscription: AutomationSubscription
        handler: (event: AutomationEvent) => void
    }>()

    return {
        subscribe(
            subscription: Omit<AutomationSubscription, 'id'>,
            handler: (event: AutomationEvent) => void,
        ): string {
            const id = `sub-${subscriptions.size + 1}`
            subscriptions.set(id, {
                subscription: {id, ...subscription},
                handler,
            })
            return id
        },
        unsubscribe(id: string): boolean {
            return subscriptions.delete(id)
        },
        clearSession(sessionId: string): void {
            for (const [id, entry] of subscriptions.entries()) {
                if (entry.subscription.sessionId === sessionId) {
                    subscriptions.delete(id)
                }
            }
        },
        clear(): void {
            subscriptions.clear()
        },
        list(): readonly AutomationSubscription[] {
            return [...subscriptions.values()].map(entry => entry.subscription)
        },
        publish(event: AutomationEvent): number {
            let delivered = 0
            for (const {subscription, handler} of subscriptions.values()) {
                if (subscription.target && subscription.target !== event.target) continue
                if (subscription.topic && subscription.topic !== event.topic) continue
                handler(event)
                delivered += 1
            }
            return delivered
        },
    }
}
```

- [ ] **Step 8: Run engine tests and type-check**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-engines`

Expected: PASS.

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime type-check`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add 2-ui/2.1-base/ui-automation-runtime
git commit -m "Add query action wait event and trace primitives for automation runtime"
```

---

## Task 6: Add Web / Expo automation host and script executor adapter

**Files:**
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/scriptExecutorAdapter.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/browserAutomationHost.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/src/supports/webSocketAutomationHost.ts`
- Modify: `2-ui/2.1-base/ui-automation-runtime/src/supports/index.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-hosts.spec.ts`
- Create: `2-ui/2.1-base/ui-automation-runtime/test-expo/App.tsx`
- Create: `2-ui/2.1-base/ui-automation-runtime/test-expo/AutomationRuntimeExpoShell.tsx`
- Create: `2-ui/2.1-base/ui-automation-runtime/test-expo/runAutomation.mjs`
- Create: `2-ui/2.1-base/ui-automation-runtime/test-expo/tsconfig.json`

- [ ] **Step 1: Write the failing host adapter test**

Create `2-ui/2.1-base/ui-automation-runtime/test/scenarios/ui-automation-runtime-hosts.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createBrowserScriptExecutorAdapter} from '../../src/supports/scriptExecutorAdapter'
import {createBrowserAutomationHost} from '../../src/supports/browserAutomationHost'

describe('automation host adapters', () => {
    it('executes scripts through an injected host executor', async () => {
        const adapter = createBrowserScriptExecutorAdapter({
            execute(source, params) {
                return {source, params}
            },
        })

        await expect(adapter.execute({
            source: 'return params.value',
            params: {value: 42},
        })).resolves.toEqual({
            source: 'return params.value',
            params: {value: 42},
        })
    })

    it('does not start browser host until explicitly started', () => {
        const host = createBrowserAutomationHost({autoStart: false})
        expect(host.started).toBe(false)
        host.start()
        expect(host.started).toBe(true)
        host.stop()
        expect(host.started).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify host support is missing**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-hosts`

Expected: FAIL with missing host adapter exports.

- [ ] **Step 3: Define the script executor adapter**

Create `2-ui/2.1-base/ui-automation-runtime/src/supports/scriptExecutorAdapter.ts`:

```ts
export interface AutomationScriptExecutionInput {
    readonly source: string
    readonly params?: Record<string, unknown>
    readonly globals?: Record<string, unknown>
    readonly timeoutMs?: number
}

export interface AutomationScriptExecutorAdapter {
    execute<T = unknown>(input: AutomationScriptExecutionInput): Promise<T>
}

export const createBrowserScriptExecutorAdapter = (host: {
    execute<T = unknown>(
        source: string,
        params?: Record<string, unknown>,
        globals?: Record<string, unknown>,
        timeoutMs?: number,
    ): T | Promise<T>
}): AutomationScriptExecutorAdapter => ({
    async execute<T = unknown>(input: AutomationScriptExecutionInput): Promise<T> {
        return await host.execute<T>(input.source, input.params, input.globals, input.timeoutMs)
    },
})
```

- [ ] **Step 4: Add an inert browser host wrapper**

Create `2-ui/2.1-base/ui-automation-runtime/src/supports/browserAutomationHost.ts`:

```ts
export interface BrowserAutomationHost {
    readonly started: boolean
    start(): void
    stop(): void
}

export const createBrowserAutomationHost = (options: {
    readonly autoStart?: boolean
} = {}): BrowserAutomationHost => {
    let started = false
    const host = {
        get started() {
            return started
        },
        start() {
            started = true
        },
        stop() {
            started = false
        },
    }
    if (options.autoStart) {
        host.start()
    }
    return host
}
```

- [ ] **Step 5: Add a minimal WebSocket host abstraction without importing a concrete WS dependency**

Create `2-ui/2.1-base/ui-automation-runtime/src/supports/webSocketAutomationHost.ts`:

```ts
export interface AutomationMessageTransport {
    send(message: string): void
    close(): void
}

export interface WebSocketAutomationHost {
    attach(transport: AutomationMessageTransport): () => void
    broadcast(message: string): void
}

export const createWebSocketAutomationHost = (): WebSocketAutomationHost => {
    const transports = new Set<AutomationMessageTransport>()
    return {
        attach(transport) {
            transports.add(transport)
            return () => {
                transports.delete(transport)
            }
        },
        broadcast(message) {
            for (const transport of transports) {
                transport.send(message)
            }
        },
    }
}
```

- [ ] **Step 6: Export host supports**

Update `2-ui/2.1-base/ui-automation-runtime/src/supports/index.ts`:

```ts
export * from './semanticNodeRegistration'
export * from './scriptExecutorAdapter'
export * from './browserAutomationHost'
export * from './webSocketAutomationHost'
```

- [ ] **Step 7: Run the host tests**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test -- ui-automation-runtime-hosts`

Expected: PASS.

- [ ] **Step 8: Add the package-level Expo shell skeleton**

Create `2-ui/2.1-base/ui-automation-runtime/test-expo/App.tsx`:

```tsx
import React from 'react'
import {AutomationRuntimeExpoShell} from './AutomationRuntimeExpoShell'

const App: React.FC = () => <AutomationRuntimeExpoShell />

export default App
```

Create `2-ui/2.1-base/ui-automation-runtime/test-expo/AutomationRuntimeExpoShell.tsx`:

```tsx
import React, {useEffect, useMemo} from 'react'
import {Text, View} from 'react-native'
import {createAutomationRuntime} from '../src/application'
import {createBrowserAutomationHost} from '../src/supports'

export const AutomationRuntimeExpoShell: React.FC = () => {
    const runtime = useMemo(() => createAutomationRuntime({
        buildProfile: 'test',
        scriptExecutionAvailable: true,
    }), [])

    const host = useMemo(() => createBrowserAutomationHost({autoStart: false}), [])

    useEffect(() => {
        host.start()
        return () => host.stop()
    }, [host])

    const hello = runtime.hello()

    return (
        <View testID="ui-base-automation-runtime-expo:ready" style={{padding: 24}}>
            <Text>UI Automation Runtime Test Expo</Text>
            <Text testID="ui-base-automation-runtime-expo:protocol">
                {String(hello.protocolVersion)}
            </Text>
            <Text testID="ui-base-automation-runtime-expo:host">
                {String(host.started)}
            </Text>
        </View>
    )
}
```

Create `2-ui/2.1-base/ui-automation-runtime/test-expo/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["./**/*", "../src/**/*"]
}
```

- [ ] **Step 9: Add the initial Expo automation runner**

Create `2-ui/2.1-base/ui-automation-runtime/test-expo/runAutomation.mjs` based on sibling `test-expo/runAutomation.mjs`, but with these package-specific checks:

```js
const readySelector = '[data-testid="ui-base-automation-runtime-expo:ready"]'
const protocolSelector = '[data-testid="ui-base-automation-runtime-expo:protocol"]'
const hostSelector = '[data-testid="ui-base-automation-runtime-expo:host"]'
```

The runner must:

1. start Expo Web on a free port,
2. open it with `agent-browser`,
3. wait for `readySelector`,
4. assert protocol text is `1`,
5. assert host text is `true`,
6. stop Expo.

- [ ] **Step 10: Run test-expo type-check**

Run: `corepack yarn workspace @impos2/ui-base-automation-runtime test-expo`

Expected: PASS for TypeScript and browser smoke flow.

- [ ] **Step 11: Commit**

```bash
git add 2-ui/2.1-base/ui-automation-runtime
git commit -m "Add web and Expo automation host support"
```

---

## Task 7: Register automation semantic nodes from `runtime-react` host components without changing business packages

**Files:**
- Create: `2-ui/2.1-base/runtime-react/src/types/automation.ts`
- Modify: `2-ui/2.1-base/runtime-react/src/types/index.ts`
- Modify: `2-ui/2.1-base/runtime-react/src/ui/components/UiRuntimeRootShell.tsx`
- Modify: `2-ui/2.1-base/runtime-react/src/ui/components/ScreenContainer.tsx`
- Modify: `2-ui/2.1-base/runtime-react/src/ui/components/OverlayHost.tsx`
- Modify: `2-ui/2.1-base/runtime-react/src/ui/components/AlertHost.tsx`
- Test: `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-automation-registration.spec.tsx`

- [ ] **Step 1: Write the failing runtime-react registration test**

Create `2-ui/2.1-base/runtime-react/test/scenarios/runtime-react-automation-registration.spec.tsx`:

```tsx
import React from 'react'
import {describe, expect, it} from 'vitest'
import TestRenderer from 'react-test-renderer'
import {UiRuntimeRootShell} from '../../src/ui/components/UiRuntimeRootShell'

describe('runtime-react automation registration', () => {
    it('keeps stable testIDs on root automation anchors', () => {
        const tree = TestRenderer.create(<UiRuntimeRootShell display="primary" />)

        expect(tree.root.findByProps({testID: 'ui-base-root-shell:primary'})).toBeTruthy()
        expect(tree.root.findByProps({testID: 'ui-base-overlay-host'})).toBeTruthy()
        expect(tree.root.findByProps({testID: 'ui-base-alert-host'})).toBeTruthy()
    })
})
```

- [ ] **Step 2: Run the test before wiring any automation dependency**

Run: `corepack yarn workspace @impos2/ui-base-runtime-react test -- runtime-react-automation-registration`

Expected: PASS today for stable anchors. This locks existing behavior before adding optional automation registration.

- [ ] **Step 3: Add a local injection contract instead of a package dependency**

Create `2-ui/2.1-base/runtime-react/src/types/automation.ts`:

```ts
export interface RuntimeReactAutomationNodeRegistration {
    readonly target: 'primary' | 'secondary'
    readonly runtimeId: string
    readonly screenKey: string
    readonly mountId: string
    readonly nodeId: string
    readonly testID?: string
    readonly semanticId?: string
    readonly role?: string
    readonly text?: string
    readonly visible: boolean
    readonly enabled: boolean
    readonly focused?: boolean
    readonly bounds?: {
        readonly x: number
        readonly y: number
        readonly width: number
        readonly height: number
    }
    readonly availableActions: readonly string[]
    readonly persistent?: boolean
}

export interface RuntimeReactAutomationBridge {
    registerNode(node: RuntimeReactAutomationNodeRegistration): () => void
    updateNode(
        target: 'primary' | 'secondary',
        nodeId: string,
        patch: Partial<RuntimeReactAutomationNodeRegistration>,
    ): void
    clearVisibleContexts(
        target: 'primary' | 'secondary',
        visibleContextKeys: readonly string[],
    ): void
    clearTarget(target: 'primary' | 'secondary'): void
}
```

Update `2-ui/2.1-base/runtime-react/src/types/index.ts`:

```ts
export * from './automation'
export * from './parts'
export * from './rendering'
```

- [ ] **Step 4: Add non-invasive registration helpers in runtime-react components**

Do not make automation runtime required at render time. Add only optional props that accept the local bridge interface and no-op when absent. This avoids coupling `runtime-react` back to `ui-automation-runtime` and keeps assembly in charge of the actual adapter wiring.

For `UiRuntimeRootShell.tsx`, extend props:

```ts
import type {RuntimeReactAutomationBridge} from '../../types'

export interface UiRuntimeRootShellProps {
    display?: 'primary' | 'secondary'
    children?: React.ReactNode
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
}
```

Thread the same optional `automationBridge` / `automationRuntimeId` props into `ScreenContainer`, `OverlayHost`, and `AlertHost`.

Keep existing rendering unchanged when `automationBridge` is absent.

- [ ] **Step 5: Do not push automation into business screens**

Confirm by search:

Run: `rg "automationBridge|RuntimeReactAutomationBridge|ui-base-automation-runtime" 2-ui/2.1-base/admin-console 2-ui/2.1-base/terminal-console 2-ui/2.3-integration/retail-shell`

Expected: no matches.

- [ ] **Step 6: Run runtime-react tests**

Run: `corepack yarn workspace @impos2/ui-base-runtime-react test -- runtime-react-automation-registration`

Expected: PASS.

Run: `corepack yarn workspace @impos2/ui-base-runtime-react type-check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 2-ui/2.1-base/runtime-react
git commit -m "Expose optional automation registration anchors in runtime react"
```

---

## Task 8: Add an explicit transitional bridge for one Expo automation smoke flow

**Files:**
- Modify: `2-ui/2.1-base/input-runtime/test-expo/runAutomation.mjs`
- Modify if needed: `2-ui/2.1-base/input-runtime/package.json`
- Test: `2-ui/2.1-base/input-runtime/test-expo/runAutomation.mjs`

- [ ] **Step 1: Preserve the existing `input-runtime` Expo test as the baseline**

Run: `corepack yarn workspace @impos2/ui-base-input-runtime test-expo`

Expected: PASS before migration. If it fails due to environment, record the blocker before changing the script.

- [ ] **Step 2: Introduce a local transitional automation client helper in the test script**

Inside `2-ui/2.1-base/input-runtime/test-expo/runAutomation.mjs`, add a small helper object instead of direct ad-hoc functions:

```js
const createAutomationClient = (session) => ({
    async queryByTestId(testId) {
        return await evalInBrowser(session, `(() => {
            const node = document.querySelector('[data-testid="${testId}"]')
            if (!node) return null
            const rect = node.getBoundingClientRect()
            return JSON.stringify({
                testID: '${testId}',
                visible: rect.width > 0 && rect.height > 0,
                bounds: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
                text: node.textContent,
            })
        })()`)
    },
    async performAction(testId, action) {
        if (action !== 'press') {
            throw new Error(`Unsupported test-expo action: ${action}`)
        }
        await clickTestId(session, testId)
    },
})
```

- [ ] **Step 3: Use the helper for at least one representative action**

Replace one direct `clickTestId(session, 'ui-base-input-runtime-expo:pin')` call with:

```js
const automation = createAutomationClient(session)
const pinNode = await automation.queryByTestId('ui-base-input-runtime-expo:pin')
if (!pinNode?.visible) {
    throw new Error(`PIN field is not visible: ${JSON.stringify(pinNode)}`)
}
await automation.performAction('ui-base-input-runtime-expo:pin', 'press')
```

- [ ] **Step 4: Run the transitional Expo smoke test**

Run: `corepack yarn workspace @impos2/ui-base-input-runtime test-expo`

Expected: PASS with behavior identical to the baseline.

Note: this task is intentionally a bridge step, not the final runtime-backed migration. It exists to reshape the test script around semantic query/action concepts before the WebSocket-backed `ui-automation-runtime` client is wired into real package automation flows.

- [ ] **Step 5: Commit**

```bash
git add 2-ui/2.1-base/input-runtime/test-expo/runAutomation.mjs
git commit -m "Add transitional semantic action helper for Expo automation"
```

---

## Task 9: Add adb-only localhost automation socket transport to `adapter-android-v2`

**Files:**
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationMessageCodec.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationSession.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationSocketServer.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationHostBridge.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationScriptExecutorBridge.kt`
- Modify: `3-adapter/android/adapter-android-v2/adapter-lib/build.gradle`
- Test: `3-adapter/android/adapter-android-v2/adapter-lib/src/test/**`

- [ ] **Step 1: Write the failing Kotlin codec/server test**

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/test/java/com/impos2/adapterv2/automation/AutomationMessageCodecTest.kt`:

```kotlin
package com.impos2.adapterv2.automation

import kotlin.test.Test
import kotlin.test.assertEquals

class AutomationMessageCodecTest {
  @Test
  fun `encodes and decodes newline delimited json messages`() {
    val codec = AutomationMessageCodec()
    val line = codec.encode("""{"id":"1","method":"session.hello"}""")
    assertEquals("{\"id\":\"1\",\"method\":\"session.hello\"}\n", line)
    assertEquals("{\"id\":\"1\",\"method\":\"session.hello\"}", codec.decode(line))
  }
}
```

- [ ] **Step 2: Run the adapter unit test to verify the automation package does not exist**

Run: `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:testDebugUnitTest --tests com.impos2.adapterv2.automation.AutomationMessageCodecTest`

Expected: FAIL with missing automation classes or test source path.

- [ ] **Step 3: Implement a minimal newline-delimited JSON codec**

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationMessageCodec.kt`:

```kotlin
package com.impos2.adapterv2.automation

class AutomationMessageCodec {
  fun encode(message: String): String = if (message.endsWith("\n")) message else "$message\n"

  fun decode(line: String): String = line.trimEnd('\n', '\r')
}
```

- [ ] **Step 4: Add a real socket accept/read/write loop and session shell**

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationSession.kt`:

```kotlin
package com.impos2.adapterv2.automation

data class AutomationSession(
  val sessionId: String,
  val clientAddress: String?,
)
```

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationSocketServer.kt`:

```kotlin
package com.impos2.adapterv2.automation

import java.net.InetAddress
import java.net.Socket
import java.net.ServerSocket
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class AutomationSocketServer(
  private val port: Int,
  private val codec: AutomationMessageCodec,
  private val bridge: AutomationHostBridge,
) {
  private val started = AtomicBoolean(false)
  private val executor = Executors.newCachedThreadPool()
  private var serverSocket: ServerSocket? = null

  fun start() {
    if (started.compareAndSet(false, true)) {
      serverSocket = ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"))
      executor.execute {
        while (started.get()) {
          val socket = try {
            serverSocket?.accept()
          } catch (_: Exception) {
            null
          } ?: break
          executor.execute { handleClient(socket) }
        }
      }
    }
  }

  private fun handleClient(socket: Socket) {
    val session = AutomationSession(
      sessionId = UUID.randomUUID().toString(),
      clientAddress = socket.inetAddress?.hostAddress,
    )
    socket.bufferedReader().use { reader ->
      socket.getOutputStream().bufferedWriter().use { writer ->
        while (started.get()) {
          val line = reader.readLine() ?: break
          val response = bridge.onMessage(session, codec.decode(line))
          writer.write(codec.encode(response))
          writer.flush()
        }
      }
    }
    bridge.onDisconnect(session)
    socket.close()
  }

  fun stop() {
    if (started.compareAndSet(true, false)) {
      serverSocket?.close()
      serverSocket = null
    }
  }

  fun isStarted(): Boolean = started.get()
}
```

- [ ] **Step 5: Add script bridge wrappers without changing existing script engine semantics**

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationScriptExecutorBridge.kt`:

```kotlin
package com.impos2.adapterv2.automation

import com.impos2.adapterv2.interfaces.IScriptEngine
import com.impos2.adapterv2.scripts.ScriptExecutionOptions

class AutomationScriptExecutorBridge(
  private val scriptEngine: IScriptEngine,
) {
  fun execute(script: String, paramsJson: String, globalsJson: String, timeoutMs: Long): String {
    val result = scriptEngine.executeScript(
      ScriptExecutionOptions(
        script = script,
        paramsJson = paramsJson,
        globalsJson = globalsJson,
        timeoutMs = timeoutMs,
      )
    )
    return result.resultJson ?: "null"
  }
}
```

Create `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/automation/AutomationHostBridge.kt`:

```kotlin
package com.impos2.adapterv2.automation

interface AutomationHostBridge {
  fun onMessage(session: AutomationSession, message: String): String
  fun onDisconnect(session: AutomationSession)
}
```

- [ ] **Step 6: Add the test dependency if Kotlin tests are not already enabled**

If `adapter-lib/build.gradle` is missing unit-test support, append:

```groovy
dependencies {
  testImplementation 'org.jetbrains.kotlin:kotlin-test'
}
```

- [ ] **Step 7: Run adapter unit tests**

Run: `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:testDebugUnitTest --tests com.impos2.adapterv2.automation.AutomationMessageCodecTest`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 3-adapter/android/adapter-android-v2/adapter-lib
git commit -m "Add adb-only localhost automation transport primitives to adapter android v2"
```

- [ ] **Step 9: Keep protocol dispatch out of the adapter layer**

Do not implement JSON-RPC method routing in `adapter-android-v2`. The adapter must stay transport-only:

1. `AutomationSocketServer` only accepts sockets, reads messages, writes responses, and notifies disconnects.
2. `AutomationHostBridge.onMessage(...)` remains an opaque bridge boundary.
3. JSON-RPC parsing, target lookup, Product guard, and method execution belong to the assembly-side dispatcher in Task 10.

Add this note to `AutomationHostBridge.kt` as KDoc:

```kotlin
/**
 * Transport-only bridge. Protocol dispatch must stay above the adapter layer.
 */
```

---

## Task 10: Wire automation startup and Product gating in `mixc-retail-assembly-rn84`

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createAssemblyAutomation.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createAutomationRequestDispatcher.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createRuntimeReactAutomationBridge.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-automation.spec.ts`

- [ ] **Step 1: Write the failing assembly automation gating test**

Create `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-automation.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {createAssemblyAutomation} from '../../src/application/automation/createAssemblyAutomation'

describe('assembly automation gating', () => {
    it('does not start automation in product mode', () => {
        const automation = createAssemblyAutomation({
            buildProfile: 'product',
            displayIndex: 0,
            scriptExecutionAvailable: true,
        })
        const unregister = automation.start('product-runtime')

        expect(automation.started).toBe(false)
        expect(automation.runtime).toBeUndefined()
        expect(automation.semanticRegistry).toBeUndefined()
        expect(automation.dispatcher).toBeUndefined()
        expect(typeof unregister).toBe('function')
        expect(() => unregister()).not.toThrow()
    })

    it('keeps protocol metadata available for explicit product-mode verification only', () => {
        const automation = createAssemblyAutomation({
            buildProfile: 'product',
            displayIndex: 0,
            scriptExecutionAvailable: true,
            exposeProductRuntimeForTest: true,
        })

        expect(automation.runtime.hello().productMode).toBe(true)
        expect(automation.runtime.hello().scriptExecutionAvailable).toBe(false)
    })

    it('starts automation in debug mode and registers the target', () => {
        const automation = createAssemblyAutomation({
            buildProfile: 'debug',
            displayIndex: 1,
            scriptExecutionAvailable: true,
        })

        automation.start('secondary-runtime')
        expect(automation.started).toBe(true)
        expect(automation.runtime.hello().availableTargets).toContain('secondary')
    })
})
```

- [ ] **Step 2: Run the test to verify assembly automation wiring is missing**

Run: `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test -- assembly-automation`

Expected: FAIL with missing assembly automation module.

- [ ] **Step 3: Implement a thin assembly automation wrapper**

Create `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createAssemblyAutomation.ts`:

```ts
import {
    createAutomationRuntime,
    createSemanticRegistry,
    type SemanticRegistry,
} from '@impos2/ui-base-automation-runtime'

export interface CreateAssemblyAutomationOptions {
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly displayIndex: number
    readonly scriptExecutionAvailable: boolean
    readonly exposeProductRuntimeForTest?: boolean
}

export const createAssemblyAutomation = (options: CreateAssemblyAutomationOptions) => {
    if (options.buildProfile === 'product' && options.exposeProductRuntimeForTest !== true) {
        return {
            runtime: undefined,
            dispatcher: undefined,
            semanticRegistry: undefined,
            get started() {
                return false
            },
            start() {
                return () => {}
            },
        }
    }

    const runtime = createAutomationRuntime({
        buildProfile: options.buildProfile,
        scriptExecutionAvailable: options.scriptExecutionAvailable,
    })

    let started = false
    let semanticRegistry: SemanticRegistry | undefined

    return {
        runtime,
        dispatcher: undefined,
        get started() {
            return started
        },
        get semanticRegistry() {
            return semanticRegistry
        },
        start(runtimeId: string) {
            if (options.buildProfile === 'product') {
                return () => {}
            }
            started = true
            semanticRegistry = semanticRegistry ?? createSemanticRegistry()
            return runtime.registerTarget({
                target: options.displayIndex > 0 ? 'secondary' : 'primary',
                runtimeId,
            })
        },
    }
}
```

Create `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/index.ts`:

```ts
export * from './createAssemblyAutomation'
```

- [ ] **Step 4: Add the assembly-side protocol dispatcher and Product guard**

Create `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createAutomationRequestDispatcher.ts`:

```ts
import type {AutomationRuntime} from '@impos2/ui-base-automation-runtime'

export interface AutomationJsonRpcRequest {
    readonly id?: string | number | null
    readonly method: string
    readonly params?: Record<string, unknown>
    readonly target?: string
}

export const createAutomationRequestDispatcher = (input: {
    readonly runtime: AutomationRuntime
}) => ({
    async dispatch(request: AutomationJsonRpcRequest) {
        if (
            request.method === 'scripts.execute'
            && input.runtime.hello().scriptExecutionAvailable !== true
        ) {
            return {
                id: request.id ?? null,
                error: {
                    code: 'METHOD_NOT_AVAILABLE',
                    message: 'scripts.execute is not available in the current build profile',
                },
            }
        }

        if (request.method === 'session.hello') {
            return {
                id: request.id ?? null,
                result: input.runtime.hello(),
            }
        }

        return {
            id: request.id ?? null,
            error: {
                code: 'METHOD_NOT_IMPLEMENTED',
                message: `Unsupported automation method: ${request.method}`,
            },
        }
    },
})
```

- [ ] **Step 5: Adapt `ui-automation-runtime` registry to the local `runtime-react` bridge contract**

Create `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/createRuntimeReactAutomationBridge.ts`:

```ts
import type {SemanticRegistry} from '@impos2/ui-base-automation-runtime'
import type {RuntimeReactAutomationBridge} from '@impos2/ui-base-runtime-react'

export const createRuntimeReactAutomationBridge = (
    registry: SemanticRegistry,
): RuntimeReactAutomationBridge => ({
    registerNode(node) {
        return registry.registerNode(node)
    },
    updateNode(target, nodeId, patch) {
        registry.updateNode(target, nodeId, patch)
    },
    clearVisibleContexts(target, visibleContextKeys) {
        registry.clearScreenContext(target, visibleContextKeys)
    },
    clearTarget(target) {
        registry.clearTarget(target)
    },
})
```

- [ ] **Step 6: Export the automation module from assembly application**

Update `4-assembly/android/mixc-retail-assembly-rn84/src/application/index.ts`:

```ts
export * from './createApp'
export * from './createModule'
export * from './bootstrapRuntime'
export * from './resolveTopologyLaunch'
export * from './reportAppLoadComplete'
export * from './adminConsoleConfig'
export * from './automation'
```

- [ ] **Step 7: Integrate Product-safe startup into `App.tsx`**

In `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`, after runtime start succeeds, add:

```ts
import {createAssemblyAutomation} from './src/application'
```

and inside the boot effect:

```ts
const buildProfile = __DEV__ ? 'debug' : 'product'
const automation = buildProfile === 'product'
    ? undefined
    : createAssemblyAutomation({
        buildProfile,
        displayIndex: props.displayIndex,
        scriptExecutionAvailable: true,
    })
const unregisterAutomation = automation?.start(`display-${props.displayIndex}`) ?? (() => {})
```

After `automation.start(...)`, derive a `runtimeReactAutomationBridge` only when `automation?.semanticRegistry` exists:

```ts
const runtimeReactAutomationBridge = automation?.semanticRegistry
    ? createRuntimeReactAutomationBridge(automation.semanticRegistry)
    : undefined
```

Pass this bridge only into `UiRuntimeRootShell` or equivalent root host entry. Do not thread automation props into business package renderers.

Store `unregisterAutomation` and call it in the cleanup path for that effect.

- [ ] **Step 8: Ensure platform ports keep reusing the existing native script executor**

Do not replace `nativeScriptExecutor` in `src/platform-ports/createPlatformPorts.ts`.
Add only a clarifying test or comment-free assertion path through the automation wrapper that `scriptExecutionAvailable` depends on this existing port, not on a second script system.

- [ ] **Step 9: Run assembly tests and type-check**

Run: `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test -- assembly-automation`

Expected: PASS.

Run: `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 type-check`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84
git commit -m "Wire product-safe automation startup into the Android assembly"
```

---

## Task 11: Add Android native bridge startup control only if the TurboModule path is required

**Files:**
- Create if needed: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/specs/NativeAutomationTurboModule.ts`
- Create if needed: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/automation.ts`
- Create if needed: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/AutomationTurboModule.kt`
- Modify if needed: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/AdapterPackage.kt`
- Modify if needed: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/index.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-native-wrappers.spec.ts`

- [ ] **Step 1: Decide whether JS-only assembly startup is sufficient**

Read before editing:

1. `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/scripts.ts`
2. `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/AdapterPackage.kt`

If the assembly can start the automation path entirely through existing boot timing and existing native services, skip this task and mark it N/A in the execution log.

- [ ] **Step 2: If needed, add a failing TurboModule wrapper test**

Add one test to `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-native-wrappers.spec.ts`:

```ts
it('exposes native automation bootstrap wrapper when present', async () => {
    const mod = await import('../../src/turbomodules')
    expect(typeof (mod as any).nativeAutomation).toBe('object')
})
```

- [ ] **Step 3: Add the TurboModule spec and thin JS wrapper**

Create `src/turbomodules/specs/NativeAutomationTurboModule.ts`:

```ts
import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    startAutomationServer(port: number): Promise<void>
    stopAutomationServer(): Promise<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('AutomationTurboModule')
```

Create `src/turbomodules/automation.ts`:

```ts
import NativeAutomationTurboModule from './specs/NativeAutomationTurboModule'

export const nativeAutomation = {
    async startAutomationServer(port: number) {
        await NativeAutomationTurboModule.startAutomationServer(port)
    },
    async stopAutomationServer() {
        await NativeAutomationTurboModule.stopAutomationServer()
    },
}
```

- [ ] **Step 4: Add the native TurboModule only as a transport starter**

Create `android/app/src/main/java/com/impos2/mixcretailassemblyrn84/turbomodules/AutomationTurboModule.kt`:

```kotlin
package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AutomationTurboModule.NAME)
class AutomationTurboModule(
  reactContext: ReactApplicationContext,
) : NativeAutomationTurboModuleSpec(reactContext) {
  companion object {
    const val NAME = "AutomationTurboModule"
  }

  override fun getName(): String = NAME

  override fun startAutomationServer(port: Double, promise: Promise) {
    promise.resolve(null)
  }

  override fun stopAutomationServer(promise: Promise) {
    promise.resolve(null)
  }
}
```

Do not add protocol logic here. It must remain a transport-start bridge only.

- [ ] **Step 5: Register the module if and only if Task 11 is actually needed**

Update native `AdapterPackage.kt` and JS `src/turbomodules/index.ts` accordingly.

- [ ] **Step 6: Run wrapper tests**

Run: `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test -- assembly-native-wrappers`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84
git commit -m "Add thin native automation startup bridge only where required"
```

---

## Task 12: Add ADB verification flow for the Android automation socket

**Files:**
- Create: `scripts/android-automation-rpc.mjs`
- Modify: `package.json`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/automation/hostConfig.ts`
- Test: Android device / emulator

- [ ] **Step 1: Add a dedicated automation port mapping only if the chosen port is stable**

For `mixc-retail-assembly-rn84`, fix the Android device-side ports per process:

```js
const PRIMARY_PORT = 18584
const SECONDARY_PORT = 18585
```

Do not reuse the same device port across main / secondary processes.

- [ ] **Step 2: Add a raw socket smoke checker**

Create `scripts/android-automation-rpc.mjs` with commands:

1. `forward`
2. `hello`
3. `call`
4. `smoke`

Behavior:

1. Resolve `adb` from `ANDROID_HOME` or `PATH`
2. Default to the first connected device, unless `ANDROID_SERIAL` / `--serial` is set
3. Use `adb forward tcp:<hostPort> tcp:<devicePort>`
4. Send newline-delimited JSON-RPC to `127.0.0.1:<hostPort>`
5. Print only JSON to stdout; operational logs go to stderr

- [ ] **Step 3: Run the real-device verification sequence**

Run in order:

1. Start Metro: `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 start`
2. Configure device reverses for Metro/mock/Reactotron
3. Install latest debug APK
4. Restart app
5. `node scripts/android-automation-rpc.mjs smoke --target primary`
6. `node scripts/android-automation-rpc.mjs smoke --target secondary`
7. `node scripts/android-automation-rpc.mjs call scripts.execute --target primary --params '{"source":"return { ok: true }"}'`
8. `node scripts/android-automation-rpc.mjs type-virtual ui-base-terminal-activate-device:sandbox sandbox-test-001 --target primary`
9. `node scripts/android-automation-rpc.mjs type-virtual ui-base-terminal-activate-device:input ABC123 --target primary`
10. `node scripts/android-automation-rpc.mjs activate-device sandbox-test-001 ABC123 --target primary`
11. `node scripts/android-automation-rpc.mjs wait-activated sandbox-test-001 --target primary`

Expected:

1. Primary responds on `18584`, secondary responds on `18585`
2. `session.hello` returns protocol metadata
3. `runtime.getInfo` returns correct `displayIndex`
4. `ui.getTree` returns semantic nodes
5. `scripts.execute` returns a result in debug mode
6. `type-virtual` / `activate-device` can change real-device UI through the virtual keyboard path and `wait-activated` confirms `ACTIVATED` plus the expected `sandboxId`

- [ ] **Step 4: Record the real-device result in the task log**

If the environment is unavailable, write the blocker and leave the task uncommitted. Do not claim the Android half is validated without this step.

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-android-port-forwarding.mjs 4-assembly/android/mixc-retail-assembly-rn84/test/scripts
git commit -m "Add adb verification flow for the Android automation socket"
```

---

## Task 13: Add minimal kernel helper surfaces only if runtime facades prove insufficient

**Files:**
- Modify only if strictly required: `1-kernel/1.1-base/runtime-shell-v2/src/types/runtime.ts`
- Modify only if strictly required: `1-kernel/1.1-base/runtime-shell-v2/src/application/createKernelRuntimeApp.ts`
- Modify only if strictly required: `1-kernel/1.1-base/runtime-shell-v2/src/foundations/createKernelRuntimeV2.ts`
- Test: matching kernel tests or new targeted tests

- [ ] **Step 1: Prove insufficiency before editing kernel**

Before any kernel edit, write down which required call cannot be expressed from assembly / `ui-automation-runtime` using existing runtime methods:

1. command lookup by stable string
2. request ledger snapshot
3. current screen / overlay / alert selector

If all can already be composed, skip this task.

- [ ] **Step 2: Add one failing targeted test per missing helper**

Example for stable command lookup:

```ts
it('resolves a public command definition by stable string key', () => {
    const runtime = createKernelRuntimeApp(/* existing harness */)
    expect(runtime.getCommandDefinition('tcpControl.bootstrapTcpControl')?.key).toBe('tcpControl.bootstrapTcpControl')
})
```

- [ ] **Step 3: Implement the smallest helper only**

Example shape:

```ts
getCommandDefinition(commandKey: string): CommandDefinition | undefined
```

Do not introduce protocol, trace, registry, or automation-specific classes into kernel packages.

- [ ] **Step 4: Run only the targeted kernel tests**

Run the narrowest relevant test command, for example:

`corepack yarn workspace @impos2/kernel-base-runtime-shell-v2 test -- runtime-shell`

Expected: PASS for the new helper coverage and no unrelated automation abstractions in kernel.

- [ ] **Step 5: Commit**

```bash
git add 1-kernel/1.1-base/runtime-shell-v2
git commit -m "Add minimal runtime helper surface for automation integration"
```

---

## Task 14: Run cross-layer verification and document remaining risk

**Files:**
- Modify if needed: `docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md`
- Modify if needed: `docs/superpowers/plans/2026-04-18-ui-automation-runtime-implementation.md`

- [ ] **Step 1: Run the new UI automation runtime tests**

Run:

1. `corepack yarn workspace @impos2/ui-base-automation-runtime type-check`
2. `corepack yarn workspace @impos2/ui-base-automation-runtime test`
3. `corepack yarn workspace @impos2/ui-base-automation-runtime test-expo`

Expected: PASS.

- [ ] **Step 2: Run the touched sibling package tests**

Run:

1. `corepack yarn workspace @impos2/ui-base-runtime-react type-check`
2. `corepack yarn workspace @impos2/ui-base-runtime-react test`
3. `corepack yarn workspace @impos2/ui-base-input-runtime test-expo`
4. `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 type-check`
5. `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test`

Expected: PASS, or explicit blockers recorded.

- [ ] **Step 3: Run Android adapter tests**

Run:

1. `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:testDebugUnitTest`
2. `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:assembleDebug`

Expected: PASS.

- [ ] **Step 4: Run the real Android ADB smoke flow if available**

Run the Task 12 sequence on a real emulator or device.

Expected: `session.hello` returns a valid protocol response.

- [ ] **Step 5: Update plan/spec notes with any validated deviations**

If implementation differed from the original spec in a validated way, update:

1. `docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md`
2. `docs/superpowers/plans/2026-04-18-ui-automation-runtime-implementation.md`

with the exact reason and final behavior.

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md docs/superpowers/plans/2026-04-18-ui-automation-runtime-implementation.md
git commit -m "Document final validation state for the UI automation runtime rollout"
```
