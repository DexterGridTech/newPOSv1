# State Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `1-kernel/1.1-base/state-runtime` as the shared Redux/state infrastructure for kernel packages, then integrate it into `topology-runtime` and `runtime-shell` with persistence-aware tests and startup load logs.

**Architecture:** `state-runtime` owns the generic state contracts, store assembly, persistence/sync intents, and `RootState` augmentation surface. `topology-runtime` will use it for topology recovery state, while `runtime-shell` will use it for global catalogs and request projection read models. Request/control-plane truth remains in topology owner-ledger, not Redux.

**Tech Stack:** TypeScript, Vitest, Redux Toolkit, existing workspace package structure under `1-kernel/1.1-base`

## Implementation Note

This plan started from a whole-slice snapshot persistence model. The implementation has since been upgraded to:

1. schema-driven field persistence
2. dynamic record-entry persistence with manifest keys
3. automatic hydrate on runtime start
4. automatic dirty persistence scheduling
5. protected-entry routing to `secureStateStorage`

The old `redux-persist` style "one slice -> one large blob" model is no longer the target architecture.

---

### Task 1: Scaffold `state-runtime` Package

**Files:**
- Create: `1-kernel/1.1-base/state-runtime/package.json`
- Create: `1-kernel/1.1-base/state-runtime/tsconfig.json`
- Create: `1-kernel/1.1-base/state-runtime/src/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/moduleName.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/generated/packageVersion.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/application/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/features/commands/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/features/actors/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/features/slices/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/foundations/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/selectors/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/hooks/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/supports/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/types/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/test/index.ts`
- Test: `1-kernel/1.1-base/state-runtime/test/index.ts`

- [ ] **Step 1: Create the package skeleton**

Run:

```bash
python3 /Users/dexter/.codex/skills/workspace-package-scaffolder/scripts/scaffold_package.py \
  --target-path "1-kernel/1.1-base/state-runtime" \
  --package-name "@impos2/kernel-base-state-runtime" \
  --package-role "kernel" \
  --package-kind "kernel-base"
```

Expected: package skeleton is created without React code and includes `src/hooks/index.ts`.

- [ ] **Step 2: Verify the package tree**

Run:

```bash
find 1-kernel/1.1-base/state-runtime -maxdepth 3 -type f | sort
```

Expected: package contains the standard `1-kernel/1.1-base/*` structure and `test/index.ts`.

- [ ] **Step 3: Commit the scaffold**

```bash
git add 1-kernel/1.1-base/state-runtime
git commit -m "feat: scaffold state-runtime package"
```

### Task 2: Define State Contracts And RootState Augmentation Surface

**Files:**
- Modify: `1-kernel/1.1-base/state-runtime/src/types/index.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/types/state.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/types/slice.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/types/value.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/types/persistence.ts`
- Test: `1-kernel/1.1-base/state-runtime/test/index.ts`

- [ ] **Step 1: Write the failing contract test**

Add this test content to `1-kernel/1.1-base/state-runtime/test/index.ts`:

```ts
import {describe, expect, it} from 'vitest'
import type {
  RootState,
  StateRuntimeSliceDescriptor,
  ValueWithUpdatedAt,
} from '../src'

declare module '../src' {
  interface RootState {
    'kernel.base.state-runtime.test.slice': {
      status: ValueWithUpdatedAt<string>
    }
  }
}

describe('state-runtime contracts', () => {
  it('allows packages to extend RootState via declaration merging', () => {
    const state = {
      'kernel.base.state-runtime.test.slice': {
        status: {
          value: 'ready',
          updatedAt: 1,
        },
      },
    } satisfies RootState

    expect(state['kernel.base.state-runtime.test.slice'].status.value).toBe('ready')
  })

  it('exposes slice descriptors with persistence and sync intents', () => {
    const descriptor: StateRuntimeSliceDescriptor = {
      name: 'kernel.base.state-runtime.test.slice',
      persistIntent: 'owner-only',
      syncIntent: 'master-to-slave',
    }

    expect(descriptor.persistIntent).toBe('owner-only')
    expect(descriptor.syncIntent).toBe('master-to-slave')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-state-runtime test
```

Expected: FAIL because `RootState`, `StateRuntimeSliceDescriptor`, and `ValueWithUpdatedAt` are not defined yet.

- [ ] **Step 3: Implement the contract types**

Create `1-kernel/1.1-base/state-runtime/src/types/value.ts`:

```ts
import type {TimestampMs} from '@impos2/kernel-base-contracts'

export interface ValueWithUpdatedAt<TValue> {
  value: TValue
  updatedAt: TimestampMs
}
```

Create `1-kernel/1.1-base/state-runtime/src/types/persistence.ts`:

```ts
export type PersistIntent = 'never' | 'owner-only'

export type SyncIntent =
  | 'isolated'
  | 'master-to-slave'
  | 'slave-to-master'
```

Create `1-kernel/1.1-base/state-runtime/src/types/slice.ts`:

```ts
import type {PersistIntent, SyncIntent} from './persistence'

export interface StateRuntimeSliceDescriptor {
  name: string
  persistIntent: PersistIntent
  syncIntent?: SyncIntent
}
```

Create `1-kernel/1.1-base/state-runtime/src/types/state.ts`:

```ts
export interface RootState {}
```

Update `1-kernel/1.1-base/state-runtime/src/types/index.ts`:

```ts
export * from './state'
export * from './slice'
export * from './value'
export * from './persistence'
```

- [ ] **Step 4: Re-export the types publicly**

Update `1-kernel/1.1-base/state-runtime/src/index.ts` so it includes:

```ts
export * from './types'
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-state-runtime test
```

Expected: PASS with 2 passing assertions.

- [ ] **Step 6: Commit**

```bash
git add 1-kernel/1.1-base/state-runtime/src 1-kernel/1.1-base/state-runtime/test
git commit -m "feat: add state-runtime contracts"
```

### Task 3: Implement Generic Store Assembly In State Runtime

**Files:**
- Create: `1-kernel/1.1-base/state-runtime/src/foundations/store.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts`
- Modify: `1-kernel/1.1-base/state-runtime/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/state-runtime/src/types/slice.ts`
- Create: `1-kernel/1.1-base/state-runtime/src/types/runtime.ts`
- Test: `1-kernel/1.1-base/state-runtime/test/index.ts`

- [ ] **Step 1: Add the failing store test**

Append this test to `1-kernel/1.1-base/state-runtime/test/index.ts`:

```ts
import {configureStore, createSlice} from '@reduxjs/toolkit'
import {createStateRuntime} from '../src'

describe('state-runtime store assembly', () => {
  it('registers reducers and exposes typed state snapshots', () => {
    const slice = createSlice({
      name: 'kernel.base.state-runtime.test.counter',
      initialState: {count: 1},
      reducers: {
        increment: state => {
          state.count += 1
        },
      },
    })

    const stateRuntime = createStateRuntime({
      runtimeName: 'state-runtime-test',
      slices: [
        {
          name: slice.name,
          reducer: slice.reducer,
          persistIntent: 'never',
          syncIntent: 'isolated',
        },
      ],
      logger: {
        info() {},
        warn() {},
        error() {},
        debug() {},
        withContext() {
          return this
        },
        scope() {
          return this
        },
      } as any,
    })

    const store = stateRuntime.getStore()
    store.dispatch(slice.actions.increment())

    expect(stateRuntime.getState()[slice.name as keyof typeof stateRuntime.getState()]).toEqual({
      count: 2,
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-state-runtime test
```

Expected: FAIL because `createStateRuntime` does not exist.

- [ ] **Step 3: Implement slice runtime types**

Update `1-kernel/1.1-base/state-runtime/src/types/slice.ts`:

```ts
import type {Reducer} from '@reduxjs/toolkit'
import type {PersistIntent, SyncIntent} from './persistence'

export interface StateRuntimeSliceDescriptor<State = unknown> {
  name: string
  reducer?: Reducer<State>
  persistIntent: PersistIntent
  syncIntent?: SyncIntent
}
```

Create `1-kernel/1.1-base/state-runtime/src/types/runtime.ts`:

```ts
import type {EnhancedStore} from '@reduxjs/toolkit'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import type {RootState} from './state'
import type {StateRuntimeSliceDescriptor} from './slice'

export interface CreateStateRuntimeInput {
  runtimeName: string
  slices: readonly StateRuntimeSliceDescriptor[]
  logger: LoggerPort
}

export interface StateRuntime {
  getStore(): EnhancedStore
  getState(): RootState
  getSlices(): readonly StateRuntimeSliceDescriptor[]
}
```

- [ ] **Step 4: Implement store assembly**

Create `1-kernel/1.1-base/state-runtime/src/foundations/store.ts`:

```ts
import {configureStore, type Reducer} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '../types/slice'

export const createStateStore = (
  slices: readonly StateRuntimeSliceDescriptor[],
) => {
  const reducerMap: Record<string, Reducer> = {}

  for (const slice of slices) {
    if (slice.reducer) {
      reducerMap[slice.name] = slice.reducer
    }
  }

  if (Object.keys(reducerMap).length === 0) {
    reducerMap.__state_runtime_placeholder__ = (state = null) => state
  }

  return configureStore({
    reducer: reducerMap,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  })
}
```

Create `1-kernel/1.1-base/state-runtime/src/foundations/createStateRuntime.ts`:

```ts
import {createStateStore} from './store'
import type {CreateStateRuntimeInput, StateRuntime} from '../types/runtime'
import type {RootState} from '../types/state'

export const createStateRuntime = (
  input: CreateStateRuntimeInput,
): StateRuntime => {
  const store = createStateStore(input.slices)

  input.logger.info({
    category: 'runtime.load',
    event: 'state-runtime-created',
    message: `load ${input.runtimeName}`,
    data: {
      slices: input.slices.map(slice => slice.name),
    },
  })

  return {
    getStore() {
      return store
    },
    getState() {
      return store.getState() as RootState
    },
    getSlices() {
      return input.slices
    },
  }
}
```

Update `1-kernel/1.1-base/state-runtime/src/foundations/index.ts`:

```ts
export * from './store'
export * from './createStateRuntime'
```

Update `1-kernel/1.1-base/state-runtime/src/index.ts`:

```ts
export * from './foundations'
export * from './types'
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-state-runtime test
```

Expected: PASS and logless success.

- [ ] **Step 6: Commit**

```bash
git add 1-kernel/1.1-base/state-runtime/src 1-kernel/1.1-base/state-runtime/test
git commit -m "feat: add state-runtime store assembly"
```

### Task 4: Integrate Topology Runtime Recovery State And Persistence Tests

**Files:**
- Modify: `1-kernel/1.1-base/topology-runtime/src/types/runtime.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/foundations/createTopologyRuntime.ts`
- Create: `1-kernel/1.1-base/topology-runtime/src/types/state.ts`
- Create: `1-kernel/1.1-base/topology-runtime/src/foundations/state.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/index.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/test/scenarios/topology-runtime.spec.ts`

- [ ] **Step 1: Add failing topology recovery-state tests**

Append this test block to `1-kernel/1.1-base/topology-runtime/test/scenarios/topology-runtime.spec.ts`:

```ts
it('stores and restores topology recovery state for slave reconnect', () => {
  const topology = createTopologyRuntime({
    localNodeId: createNodeId(),
    localProtocolVersion: '0.0.1',
  })

  topology.updateRecoveryState({
    instanceMode: 'SLAVE',
    displayMode: 'SECONDARY',
    enableSlave: false,
    masterInfo: {
      deviceId: 'master-device',
      serverAddress: [{address: 'ws://127.0.0.1:9999'}],
      addedAt: 1234,
    },
  })

  expect(topology.getRecoveryState().masterInfo?.deviceId).toBe('master-device')

  const snapshot = topology.exportRecoveryState()
  const restored = createTopologyRuntime({
    localNodeId: createNodeId(),
    localProtocolVersion: '0.0.1',
  })

  restored.applyRecoveryState(snapshot)
  expect(restored.getRecoveryState().masterInfo?.serverAddress[0]?.address).toBe('ws://127.0.0.1:9999')
})
```

- [ ] **Step 2: Run topology tests to verify they fail**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-topology-runtime test
```

Expected: FAIL because recovery-state APIs are missing.

- [ ] **Step 3: Implement topology recovery state**

Create `1-kernel/1.1-base/topology-runtime/src/types/state.ts`:

```ts
import type {TimestampMs} from '@impos2/kernel-base-contracts'

export interface TopologyMasterAddress {
  address: string
}

export interface TopologyMasterInfo {
  deviceId: string
  serverAddress: TopologyMasterAddress[]
  addedAt: TimestampMs
}

export interface TopologyRecoveryState {
  instanceMode?: string
  displayMode?: string
  enableSlave?: boolean
  masterInfo?: TopologyMasterInfo | null
}
```

Create `1-kernel/1.1-base/topology-runtime/src/foundations/state.ts`:

```ts
import type {TopologyRecoveryState} from '../types/state'

export const createTopologyRecoveryState = () => {
  let state: TopologyRecoveryState = {}

  return {
    getState(): TopologyRecoveryState {
      return state
    },
    replaceState(nextState: TopologyRecoveryState) {
      state = {...nextState}
    },
    updateState(patch: TopologyRecoveryState) {
      state = {
        ...state,
        ...patch,
      }
    },
  }
}
```

Update `1-kernel/1.1-base/topology-runtime/src/types/runtime.ts`:

```ts
import type {TopologyRecoveryState} from './state'

export interface TopologyRuntime {
  // existing methods...
  getRecoveryState(): TopologyRecoveryState
  updateRecoveryState(patch: TopologyRecoveryState): void
  exportRecoveryState(): TopologyRecoveryState
  applyRecoveryState(state: TopologyRecoveryState): void
}
```

Update `1-kernel/1.1-base/topology-runtime/src/foundations/createTopologyRuntime.ts`:

```ts
import {createTopologyRecoveryState} from './state'
```

and inside `createTopologyRuntime`:

```ts
  const recoveryState = createTopologyRecoveryState()
```

and return:

```ts
        getRecoveryState() {
            return recoveryState.getState()
        },
        updateRecoveryState(patch) {
            recoveryState.updateState(patch)
        },
        exportRecoveryState() {
            return recoveryState.getState()
        },
        applyRecoveryState(state) {
            recoveryState.replaceState(state)
        },
```

Update `1-kernel/1.1-base/topology-runtime/src/index.ts`:

```ts
export * from './types/state'
export * from './foundations/state'
```

- [ ] **Step 4: Add startup load logs at topology runtime creation**

In `1-kernel/1.1-base/topology-runtime/src/foundations/createTopologyRuntime.ts`, add:

```ts
    input.logger?.info?.({
        category: 'runtime.load',
        event: 'topology-runtime-created',
        message: 'load topology-runtime',
        data: {
            localNodeId: input.localNodeId,
            localProtocolVersion: input.localProtocolVersion ?? '0.0.1',
            localCapabilities: input.localCapabilities ?? [],
        },
    })
```

If logger injection does not exist yet, extend `CreateTopologyRuntimeInput` to accept it.

- [ ] **Step 5: Re-run topology tests**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-topology-runtime test
```

Expected: PASS including the new recovery-state test.

- [ ] **Step 6: Commit**

```bash
git add 1-kernel/1.1-base/topology-runtime
git commit -m "feat: add topology recovery state"
```

### Task 5: Integrate Runtime Shell With State Runtime And Load Logs

**Files:**
- Modify: `1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/src/types/state.ts`
- Modify: `1-kernel/1.1-base/runtime-shell/test/index.ts`

- [ ] **Step 1: Add failing runtime-shell assertions for load logs and state integration**

In `1-kernel/1.1-base/runtime-shell/test/index.ts`, replace the `write: () => {}` logger writers with:

```ts
const logEvents: Array<{event?: string; message?: string}> = []
```

and use:

```ts
write: event => {
  logEvents.push({event: event.event, message: event.message})
}
```

Add assertions after `await runtime.start()`:

```ts
if (!logEvents.some(event => event.event === 'kernel-runtime-start')) {
  throw new Error('Runtime shell did not emit kernel runtime start log')
}

if (!logEvents.some(event => event.event === 'kernel-runtime-modules-resolved')) {
  throw new Error('Runtime shell did not emit module load log')
}
```

- [ ] **Step 2: Run runtime-shell tests to verify they fail**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-runtime-shell test
```

Expected: FAIL because these load events are not emitted yet.

- [ ] **Step 3: Add load logs similar to old ApplicationManager startup**

In `1-kernel/1.1-base/runtime-shell/src/foundations/createKernelRuntime.ts`, emit structured startup logs:

```ts
    input.platformPorts.logger.info({
        category: 'runtime.load',
        event: 'kernel-runtime-start',
        message: 'start kernel runtime',
        data: {
            runtimeId,
            localNodeId: input.localNodeId,
        },
    })
```

After resolving modules:

```ts
    input.platformPorts.logger.info({
        category: 'runtime.load',
        event: 'kernel-runtime-modules-resolved',
        message: 'resolved kernel runtime modules',
        data: {
            modules: modules.map(module => module.moduleName),
        },
    })
```

Add one log around host bootstrap and one around install:

```ts
    input.platformPorts.logger.info({
        category: 'runtime.load',
        event: 'kernel-runtime-host-bootstrap',
        message: 'host bootstrap modules',
        data: {
            modules: modules.filter(module => module.hostBootstrap).map(module => module.moduleName),
        },
    })
```

```ts
    input.platformPorts.logger.info({
        category: 'runtime.load',
        event: 'kernel-runtime-install',
        message: 'install modules',
        data: {
            modules: modules.filter(module => module.install).map(module => module.moduleName),
        },
    })
```

- [ ] **Step 4: Re-run runtime-shell tests**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-runtime-shell test
```

Expected: PASS with startup log assertions satisfied.

- [ ] **Step 5: Commit**

```bash
git add 1-kernel/1.1-base/runtime-shell
git commit -m "feat: add runtime load logs"
```

### Task 6: Type-Check And Final Verification

**Files:**
- Modify: `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md`

- [ ] **Step 1: Run package type-checks**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-state-runtime type-check
```

Run:

```bash
corepack yarn workspace @impos2/kernel-base-topology-runtime type-check
```

Run:

```bash
corepack yarn workspace @impos2/kernel-base-runtime-shell type-check
```

Expected: all three commands PASS without TS errors.

- [ ] **Step 2: Run tests**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-state-runtime test
```

Run:

```bash
corepack yarn workspace @impos2/kernel-base-topology-runtime test
```

Run:

```bash
corepack yarn workspace @impos2/kernel-base-runtime-shell test
```

Expected: all three commands PASS.

- [ ] **Step 3: Update progress doc**

Add a note to `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md` summarizing:

```md
### 5.x `state-runtime` 首轮实现完成

已完成：

1. `state-runtime` 包骨架
2. `RootState` 声明合并扩展点
3. 通用 store/slice descriptor 基础设施
4. `topology-runtime` 恢复型 state 接入
5. `runtime-shell` 加载日志补齐
6. 新增 `topology-runtime` 持久化恢复测试
```
```

- [ ] **Step 4: Commit final batch**

```bash
git add refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md
git commit -m "feat: integrate state-runtime into kernel base"
```
