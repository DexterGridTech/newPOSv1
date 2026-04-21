# Topology Standalone Slave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the new RN84 assembly with old topology semantics so managed secondary does not use local stateStorage, standalone slave keeps local persistence, and a single-screen slave can connect to an external master through admin-console and automation.

**Architecture:** Keep `topology-runtime-v2` as the shared kernel runtime and avoid broad kernel changes. Implement precise storage gating, dynamic topology socket binding, external-master ticket orchestration, admin-console topology actions, and power-triggered display switching in the assembly/admin boundary where the product-specific topology semantics belong.

**Tech Stack:** TypeScript, React Native 0.84, Vitest, `@impos2/kernel-base-topology-runtime-v2`, `@impos2/kernel-base-transport-runtime`, Android topology host HTTP `/tickets`, assembly TurboModules, admin-console semantic UI tests.

---

## File Map

### Design / docs

- Reference: `docs/superpowers/specs/2026-04-18-topology-standalone-slave-design.md`
- Modify after completion: `docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md`
- Modify after completion: `2-ui/2.1-base/README.md`

### Assembly topology and storage

- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/stateStorage.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createModule.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/resolveTopologyLaunch.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyBinding.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologySharePayload.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyExternalMaster.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyStorageGate.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyPowerDisplaySwitch.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`
- Modify or create tests:
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-state-storage.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-resolve-topology-launch.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts`
  - `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-admin-console-automation.spec.tsx`
  - Create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts`
  - Create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-power-display-switch.spec.ts`

### Admin console

- Modify: `2-ui/2.1-base/admin-console/src/types/admin.ts`
- Modify: `2-ui/2.1-base/admin-console/src/supports/adminHostToolsFactory.ts`
- Modify: `2-ui/2.1-base/admin-console/src/supports/adminConsoleModuleInputFactory.ts`
- Modify: `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`
- Modify tests:
  - `2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx`
  - `2-ui/2.1-base/admin-console/test/scenarios/admin-sections.spec.tsx`
  - `2-ui/2.1-base/admin-console/test/support/adminConsoleHarness.tsx`

### Android adapter

- No code change by default.
- Reference: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/impos2/adapterv2/topologyhostv3/TopologyHostV3Server.kt`
- Reference: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/topologyHost.ts`

---

## Task 1: Add dynamic topology storage gate without changing kernel persistence

**Files:**
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/stateStorage.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyStorageGate.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-state-storage.spec.ts`

- [ ] **Step 1: Add failing tests for the exact gate matrix**

Extend `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-state-storage.spec.ts` with:

```ts
it('disables storage only for managed secondary topology context', async () => {
    let disabled = false
    const stateStorage = createAssemblyStateStorage('state', {
        shouldDisablePersistence: () => disabled,
    })

    await stateStorage.setItem('terminal.activation', 'active')
    await expect(stateStorage.getItem('terminal.activation')).resolves.toBe('active')

    disabled = true
    await stateStorage.setItem('terminal.activation', 'managed-secondary-write')
    await expect(stateStorage.getItem('terminal.activation')).resolves.toBeNull()
    await expect(stateStorage.getAllKeys?.()).resolves.toEqual([])

    disabled = false
    await expect(stateStorage.getItem('terminal.activation')).resolves.toBe('active')
})

it('does not clear underlying storage when gate is disabled', async () => {
    let disabled = false
    const stateStorage = createAssemblyStateStorage('state', {
        shouldDisablePersistence: () => disabled,
    })

    await stateStorage.setItem('terminal.activation', 'active')
    disabled = true
    await stateStorage.clear?.()
    disabled = false

    await expect(stateStorage.getItem('terminal.activation')).resolves.toBe('active')
})
```

Expected initial result: FAIL because `createAssemblyStateStorage` does not accept the gate option and disabled mode is not implemented.

- [ ] **Step 2: Add the storage gate helper**

Create `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyStorageGate.ts`:

```ts
export interface AssemblyTopologyStorageGateSnapshot {
    displayMode?: string
    standalone?: boolean
}

export const shouldDisableAssemblyStatePersistence = (
    snapshot: AssemblyTopologyStorageGateSnapshot | undefined,
): boolean => snapshot?.displayMode === 'SECONDARY' && snapshot.standalone === false
```

Create or update `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`:

```ts
export * from './assemblyTopologyStorageGate'
```

- [ ] **Step 3: Add gated storage wrapping**

Modify `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/stateStorage.ts` so `createAssemblyStateStorage` accepts an optional dynamic gate:

```ts
export interface AssemblyStateStorageOptions {
    shouldDisablePersistence?: () => boolean
}
```

The wrapper must:

1. Call `shouldDisablePersistence()` on every operation.
2. Return `null` for `getItem` when disabled.
3. Return `{key: null}` entries for `multiGet` when disabled.
4. Return `[]` for `getAllKeys` when disabled.
5. No-op for writes, removes, multiSet, multiRemove, and clear when disabled.
6. Preserve one storage per namespace/layer, but allow the gate callback to be updated for that layer.

- [ ] **Step 4: Wire platform ports to the gated storage**

Modify `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/createPlatformPorts.ts`:

```ts
export const createAssemblyPlatformPorts = (
    environmentMode: LogEnvironmentMode,
    options: {
        shouldDisableStatePersistence?: () => boolean
    } = {},
): PlatformPorts => {
    const stateStorage = createAssemblyStateStorage('state', {
        shouldDisablePersistence: options.shouldDisableStatePersistence,
    })
    const secureStateStorage = createAssemblyStateStorage('secure-state', {
        shouldDisablePersistence: options.shouldDisableStatePersistence,
    })
    // unchanged return object
}
```

- [ ] **Step 5: Run storage tests**

Run: `corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-state-storage.spec.ts`

Expected: PASS.

- [ ] **Step 6: Type-check assembly**

Run: `corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 type-check`

Expected: PASS, or if the workspace script name differs, use the package's existing type-check/build command and record the exact command in the implementation log.

---

## Task 2: Introduce assembly topology binding source and keep socket runtime stable

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyBinding.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts`

- [ ] **Step 1: Add failing dynamic binding tests**

Extend `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts` with:

```ts
it('updates topology socket server and hello from a runtime binding source', () => {
    const logger = {
        scope: vi.fn(() => logger),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
    const bindingSource = createAssemblyTopologyBindingSource({
        role: 'slave',
        localNodeId: 'slave-device-001',
    })
    const input = createAssemblyTopologyInput({
        deviceId: 'device-001',
        screenMode: 'desktop',
        displayCount: 1,
        displayIndex: 0,
        isEmulator: true,
    }, logger as any, {bindingSource})

    expect(input).toBeDefined()
    bindingSource.set({
        role: 'slave',
        localNodeId: 'slave-device-001',
        masterNodeId: 'master-node-001',
        ticketToken: 'ticket-runtime-001',
        ticketExpiresAt: Date.now() + 60_000,
        wsUrl: 'ws://127.0.0.1:9999/mockMasterServer/ws',
        httpBaseUrl: 'http://127.0.0.1:9999/mockMasterServer',
    })

    const binding = input?.assembly?.resolveSocketBinding({
        localNodeId: 'slave-device-001',
    } as any)
    expect(binding?.socketRuntime.getServerCatalog().resolveAddresses('dual-topology-host')).toEqual([{
        addressName: 'dynamic-topology-host',
        baseUrl: 'http://127.0.0.1:9999',
    }])

    const hello = input?.assembly?.createHello({
        localNodeId: 'slave-device-001',
    } as any)
    expect(hello?.ticketToken).toBe('ticket-runtime-001')
    expect(hello?.runtime.role).toBe('slave')
})
```

Expected initial result: FAIL because no binding source exists and `createAssemblyTopologyInput` does not accept it.

- [ ] **Step 2: Implement binding source**

Create `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyBinding.ts`:

```ts
export interface AssemblyTopologyBindingState {
    role: 'master' | 'slave'
    localNodeId: string
    masterNodeId?: string
    ticketToken?: string
    ticketExpiresAt?: number
    wsUrl?: string
    httpBaseUrl?: string
}

export interface AssemblyTopologyBindingSource {
    get(): AssemblyTopologyBindingState
    set(next: Partial<AssemblyTopologyBindingState> & Pick<AssemblyTopologyBindingState, 'role' | 'localNodeId'>): void
    clear(): void
    hasUsableTicket(now?: number): boolean
}

const TICKET_REFRESH_WINDOW_MS = 15_000

export const createAssemblyTopologyBindingSource = (
    initial: AssemblyTopologyBindingState,
): AssemblyTopologyBindingSource => {
    let current = {...initial}
    return {
        get: () => ({...current}),
        set(next) {
            current = {...current, ...next}
        },
        clear() {
            current = {
                role: current.role,
                localNodeId: current.localNodeId,
            }
        },
        hasUsableTicket(now = Date.now()) {
            return Boolean(
                current.ticketToken
                    && current.ticketExpiresAt
                    && now < current.ticketExpiresAt - TICKET_REFRESH_WINDOW_MS,
            )
        },
    }
}
```

Export it from `src/application/topology/index.ts`.

- [ ] **Step 3: Update topology input to accept binding source**

Modify `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts`:

1. Add optional third argument:
   - `{bindingSource?: AssemblyTopologyBindingSource}`
2. If `props.topology` exists, seed a binding source from launch props.
3. If neither launch props nor injected binding source has a usable `localNodeId`, return `undefined`.
4. Keep one socket runtime/profile stable.
5. In `resolveSocketBinding`, read latest `wsUrl`, update `socketRuntime.replaceServers(...)`, then return the same binding.
6. In `createHello`, read latest `ticketToken` and runtime info from binding source.

- [ ] **Step 4: Preserve existing launch-based test behavior**

Update the existing test in `assembly-topology-input.spec.ts` only as needed so the current launch URL test still passes.

- [ ] **Step 5: Run topology input tests**

Run: `corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts`

Expected: PASS.

---

## Task 3: Add external master share payload parsing and ticket orchestration

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologySharePayload.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyTopologyExternalMaster.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts`

- [ ] **Step 1: Write failing share payload and ticket flow tests**

Create `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts`:

```ts
import {describe, expect, it, vi} from 'vitest'
import {
    createAssemblyTopologyBindingSource,
    importAssemblyTopologySharePayload,
    requestAssemblyTopologyTicket,
} from '../../src/application/topology'

describe('assembly standalone slave topology', () => {
    it('normalizes a master share payload into masterInfo and binding seed', () => {
        const imported = importAssemblyTopologySharePayload({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })

        expect(imported.masterInfo).toMatchObject({
            deviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            serverAddress: [{address: 'ws://127.0.0.1:8888/mockMasterServer/ws'}],
        })
        expect(imported.bindingSeed).toMatchObject({
            role: 'slave',
            masterNodeId: 'master-node-001',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })
    })

    it('requests a fresh ticket and updates the binding source', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                success: true,
                token: 'ticket-001',
                expiresAt: 9_999_999,
                transportUrls: ['ws://127.0.0.1:8888/mockMasterServer/ws'],
            }),
        }))
        const bindingSource = createAssemblyTopologyBindingSource({
            role: 'slave',
            localNodeId: 'slave-node-001',
            masterNodeId: 'master-node-001',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })

        await requestAssemblyTopologyTicket({
            bindingSource,
            fetchImpl: fetchMock as any,
        })

        expect(fetchMock).toHaveBeenCalledWith(
            'http://127.0.0.1:8888/mockMasterServer/tickets',
            expect.objectContaining({
                method: 'POST',
            }),
        )
        expect(bindingSource.get()).toMatchObject({
            ticketToken: 'ticket-001',
            ticketExpiresAt: 9_999_999,
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
        })
    })
})
```

Expected initial result: FAIL because helpers do not exist.

- [ ] **Step 2: Implement share payload parser**

Create `assemblyTopologySharePayload.ts` with:

```ts
export interface AssemblyTopologySharePayload {
    formatVersion: '2026.04' | string
    deviceId: string
    masterNodeId: string
    wsUrl?: string
    httpBaseUrl?: string
}

export type AssemblyTopologyMasterInfo = import('@impos2/kernel-base-topology-runtime-v2').TopologyV2MasterInfo & {
    masterNodeId?: string
    httpBaseUrl?: string
}
```

Implement `importAssemblyTopologySharePayload(payload)`:

1. Require `deviceId`.
2. Require `masterNodeId`.
3. Require at least one of `wsUrl` or `httpBaseUrl`.
4. Derive `httpBaseUrl` from `wsUrl` if missing.
5. Derive `wsUrl` as `${httpBaseUrl}/ws` if missing.
6. Return `{masterInfo, bindingSeed}`.

- [ ] **Step 3: Implement ticket request helper**

Create `assemblyTopologyExternalMaster.ts` with `requestAssemblyTopologyTicket(input)`:

1. Read `masterNodeId/httpBaseUrl` from binding source.
2. Throw clear errors if missing.
3. `POST ${httpBaseUrl}/tickets`.
4. Require response `success === true`.
5. Write `ticketToken/ticketExpiresAt/wsUrl` back to binding source.

- [ ] **Step 4: Run standalone slave topology tests**

Run: `corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts`

Expected: PASS.

---

## Task 4: Wire storage gate and topology binding into assembly app creation

**Files:**
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createModule.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts`

- [ ] **Step 1: Add failing createApp tests for injected gate and binding source**

Extend `assembly-create-app.spec.ts`:

```ts
it('passes topology-aware storage gate and dynamic binding source through assembly app setup', () => {
    createApp({
        deviceId: 'device-1',
        screenMode: 'desktop',
        displayCount: 1,
        displayIndex: 0,
        isEmulator: true,
    })

    expect(createAssemblyPlatformPortsMock).toHaveBeenCalledWith(
        'DEV',
        expect.objectContaining({
            shouldDisableStatePersistence: expect.any(Function),
        }),
    )
    expect(createAssemblyTopologyInputMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
            bindingSource: expect.any(Object),
        }),
    )
})
```

Expected initial result: FAIL because `createApp` does not pass these options.

- [ ] **Step 2: Create shared topology runtime environment in `createApp`**

Modify `createApp.ts`:

1. Create `const topologyBindingSource = createAssemblyTopologyBindingSource(...)`.
2. Keep mutable `latestTopologyContext` initialized from launch/display props.
3. Pass `shouldDisableStatePersistence` to `createAssemblyPlatformPorts`.
4. Pass `bindingSource` to `createAssemblyTopologyInput`.
5. Pass topology helper references into `createAssemblyAdminConsoleInput(...)`.
6. Keep Product automation gating unchanged.

- [ ] **Step 3: Update assembly runtime module to observe topology context**

Modify `createModule.ts` or assembly initialize actor so after runtime start:

1. Subscribe to store updates.
2. Read `selectTopologyRuntimeV2Context`.
3. Update the mutable topology context snapshot used by storage gate and power switch.

This subscription must return a cleanup function if the runtime shell supports cleanup; otherwise keep it minimal and idempotent.

- [ ] **Step 4: Update admin console config construction**

Modify `createAssemblyAdminConsoleInput` signature to accept optional topology host source dependencies:

```ts
export const createAssemblyAdminConsoleInput = (input: {
    topology?: AssemblyAdminTopologyInput
} = {}): CreateAdminConsoleModuleInput => ({ ... })
```

Do not yet implement UI changes in this task; only thread the dependency through.

- [ ] **Step 5: Run createApp tests**

Run: `corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts`

Expected: PASS.

---

## Task 5: Extend admin-console topology host tools and topology section UI

**Files:**
- Modify: `2-ui/2.1-base/admin-console/src/types/admin.ts`
- Modify: `2-ui/2.1-base/admin-console/src/supports/adminHostToolsFactory.ts`
- Modify: `2-ui/2.1-base/admin-console/src/supports/adminConsoleModuleInputFactory.ts`
- Modify: `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`
- Modify: `2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx`
- Modify: `2-ui/2.1-base/admin-console/test/support/adminConsoleHarness.tsx`

- [ ] **Step 1: Add failing admin-console tests**

Extend `admin-real-sections.spec.tsx`:

```ts
it('dispatches display and slave capability commands from topology section', async () => {
    const harness = await createAdminConsoleHarness()
    const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
    const topologyTree = renderWithAutomation(
        <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
        harness.store,
        harness.runtime,
    )

    await topologyTree.press('ui-base-admin-section:topology:set-primary')
    await topologyTree.press('ui-base-admin-section:topology:set-secondary')
    await topologyTree.press('ui-base-admin-section:topology:enable-slave')
    await topologyTree.press('ui-base-admin-section:topology:disable-slave')

    expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
        topologyRuntimeV2CommandDefinitions.setDisplayMode,
        {displayMode: 'PRIMARY'},
    ))
    expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
        topologyRuntimeV2CommandDefinitions.setDisplayMode,
        {displayMode: 'SECONDARY'},
    ))
    expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
        topologyRuntimeV2CommandDefinitions.setEnableSlave,
        {enableSlave: true},
    ))
    expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
        topologyRuntimeV2CommandDefinitions.setEnableSlave,
        {enableSlave: false},
    ))
})
```

Add another test for host source:

```ts
it('calls topology host action for external master connection when provided', async () => {
    const requestTicketAndConnect = vi.fn(async () => {})
    const harness = await createAdminConsoleHarness({
        hostTools: {
            topology: {
                requestTicketAndConnect,
            },
        } as any,
    })
    const topologyTree = renderWithAutomation(
        <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
        harness.store,
        harness.runtime,
    )

    await topologyTree.press('ui-base-admin-section:topology:request-ticket-connect')

    expect(requestTicketAndConnect).toHaveBeenCalledTimes(1)
})
```

Expected initial result: FAIL because buttons and host tool types do not exist.

- [ ] **Step 2: Add topology host tool types**

Modify `types/admin.ts`:

```ts
export interface AdminTopologySharePayload {
    formatVersion: string
    deviceId: string
    masterNodeId: string
    wsUrl?: string
    httpBaseUrl?: string
}

export interface AdminTopologyHost {
    getSharePayload?(): Promise<AdminTopologySharePayload | null>
    importSharePayload?(payload: AdminTopologySharePayload): Promise<void>
    clearMasterInfo?(): Promise<void>
    requestTicketAndConnect?(): Promise<void>
    getTopologyHostStatus?(): Promise<Record<string, unknown> | null>
}
```

Add `topology?: AdminTopologyHost` to `AdminHostTools`.

- [ ] **Step 3: Thread topology host source through factory**

Modify `adminHostToolsFactory.ts` and `adminConsoleModuleInputFactory.ts` to accept optional `topology` source and return it unchanged as `AdminTopologyHost`.

- [ ] **Step 4: Add topology UI actions**

Modify `AdminTopologySection.tsx`:

1. Add display buttons:
   - `ui-base-admin-section:topology:set-primary`
   - `ui-base-admin-section:topology:set-secondary`
2. Add enable/disable slave buttons:
   - `ui-base-admin-section:topology:enable-slave`
   - `ui-base-admin-section:topology:disable-slave`
3. Add clear master button using `clearMasterInfo`.
4. If `adminHostTools.topology?.requestTicketAndConnect` exists, render:
   - `ui-base-admin-section:topology:request-ticket-connect`
5. Keep existing testIDs stable.

- [ ] **Step 5: Run admin-console tests**

Run: `corepack yarn vitest run 2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx`

Expected: PASS.

---

## Task 6: Implement assembly admin topology host source

**Files:**
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/adminConsoleConfig.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-admin-console-automation.spec.tsx`

- [ ] **Step 1: Add failing assembly admin integration test**

Extend `assembly-admin-console-automation.spec.tsx` to mock topology host diagnostics with `hostRuntime.nodeId`, render admin topology, and press `request-ticket-connect`.

Expected assertion:

```ts
await automation.client.actions.press({
    target: 'primary',
    testID: 'ui-base-admin-section:topology:request-ticket-connect',
})
```

Then assert the mocked fetch/ticket helper was called once and the dynamic binding source received the new ticket.

- [ ] **Step 2: Build `topology` host source in assembly admin config**

Modify `createAssemblyAdminConsoleInput` so `topology` host source implements:

1. `getSharePayload`
   - Reads `nativeTopologyHost.getDiagnosticsSnapshot()`
   - Extracts `hostRuntime.nodeId/deviceId`
   - Reads `nativeTopologyHost.getStatus().addressInfo`
   - Returns `formatVersion/deviceId/masterNodeId/wsUrl/httpBaseUrl`
2. `importSharePayload`
   - Calls `importAssemblyTopologySharePayload`
   - Dispatches or prepares `setMasterInfo` through provided runtime helper if available
3. `requestTicketAndConnect`
   - Calls `requestAssemblyTopologyTicket`
   - Dispatches `restartTopologyConnection`
4. `clearMasterInfo`
   - Clears binding source
   - Dispatches `clearMasterInfo`

If runtime dispatch is unavailable at config creation time, pass a small mutable runtime ref from `createApp`.

- [ ] **Step 3: Run assembly admin automation tests**

Run: `corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-admin-console-automation.spec.tsx`

Expected: PASS.

---

## Task 7: Add power-triggered display switch for standalone slave

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/assemblyPowerDisplaySwitch.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/topology/index.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createModule.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-power-display-switch.spec.ts`

- [ ] **Step 1: Write failing power switch tests**

Create `assembly-power-display-switch.spec.ts`:

```ts
import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV2CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v2'
import {handleAssemblyPowerDisplaySwitch} from '../../src/application/topology'

describe('assembly power display switch', () => {
    it('switches standalone slave primary to secondary when power connects', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: true, instanceMode: 'SLAVE', displayMode: 'PRIMARY'},
            powerConnected: true,
            dispatchCommand,
        })

        expect(dispatchCommand).toHaveBeenCalledWith(createCommand(
            topologyRuntimeV2CommandDefinitions.setDisplayMode,
            {displayMode: 'SECONDARY'},
        ))
    })

    it('does not switch managed secondary', async () => {
        const dispatchCommand = vi.fn()

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: false, instanceMode: 'SLAVE', displayMode: 'SECONDARY'},
            powerConnected: false,
            dispatchCommand,
        })

        expect(dispatchCommand).not.toHaveBeenCalled()
    })
})
```

Expected initial result: FAIL because helper does not exist.

- [ ] **Step 2: Implement pure power switch helper**

Create `assemblyPowerDisplaySwitch.ts` with a pure function that:

1. Returns without dispatch unless `standalone === true && instanceMode === 'SLAVE'`.
2. Dispatches secondary when `powerConnected && displayMode === 'PRIMARY'`.
3. Dispatches primary when `!powerConnected && displayMode === 'SECONDARY'`.
4. Does not dispatch in all other cases.

- [ ] **Step 3: Wire helper into assembly runtime initialization**

Modify assembly runtime actor in `createModule.ts` or actor file:

1. Subscribe to `nativeDevice.addPowerStatusChangeListener`.
2. On event, read latest topology context snapshot.
3. Call `handleAssemblyPowerDisplaySwitch`.
4. Keep it inert when device power listener is unavailable.

- [ ] **Step 4: Run power switch tests**

Run: `corepack yarn vitest run 4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-power-display-switch.spec.ts`

Expected: PASS.

---

## Task 8: Verify standalone/managed persistence and topology flows together

**Files:**
- Modify or create: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-ui-automation-runtime.spec.tsx`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts`

- [ ] **Step 1: Add integration assertion for standalone slave secondary persistence**

Add a test that sets context to:

```ts
{instanceMode: 'SLAVE', displayMode: 'SECONDARY', standalone: true}
```

Then writes storage and asserts it persists.

- [ ] **Step 2: Add integration assertion for managed secondary no-op persistence**

Add a test that sets context to:

```ts
{instanceMode: 'SLAVE', displayMode: 'SECONDARY', standalone: false}
```

Then writes storage and asserts it does not persist.

- [ ] **Step 3: Run targeted assembly suite**

Run:

```bash
corepack yarn vitest run \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-state-storage.spec.ts \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-topology-input.spec.ts \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-standalone-slave-topology.spec.ts \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-power-display-switch.spec.ts \
  4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run targeted admin-console suite**

Run:

```bash
corepack yarn vitest run \
  2-ui/2.1-base/admin-console/test/scenarios/admin-real-sections.spec.tsx
```

Expected: PASS.

---

## Task 9: Update specs, UI layer memory, and final verification evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-04-18-topology-standalone-slave-design.md`
- Modify: `docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md`
- Modify: `2-ui/2.1-base/README.md`
- Optional memory update: project memory / wiki through available memory tools after implementation evidence is collected.

- [ ] **Step 1: Update design with final implementation notes**

Add a short “Implementation Notes” section to `2026-04-18-topology-standalone-slave-design.md` recording:

1. Actual files changed.
2. Any deviations from plan.
3. Commands used for verification.

- [ ] **Step 2: Update UI automation spec cross-reference**

Add a cross-reference in `2026-04-18-ui-automation-runtime-design.md` that topology-aware automation tests must use:

1. managed-secondary storage gate
2. standalone-slave external master flow
3. power display switch helpers

- [ ] **Step 3: Update `2-ui/2.1-base/README.md`**

Add a short convention section:

```md
### Topology-aware UI automation

UI packages should drive topology flows through admin-console and ui-automation-runtime. Managed secondary state must be treated as remote-synced and must not assume local persistence; standalone slave remains locally persistent even when displayMode is SECONDARY.
```

- [ ] **Step 4: Run final targeted verification**

Run all commands from Task 8 again after docs updates.

Expected: PASS.

- [ ] **Step 5: Record final evidence**

Final report must include:

1. Changed files.
2. Tests run and pass/fail status.
3. Any remaining risks.
4. Whether real-device A/B validation was run or still pending.

---

## Execution Notes

1. Do not commit unless explicitly requested by the user.
2. Do not modify unrelated `0-mock-server`, TCP, or TDP files currently present in the working tree.
3. If a test fails due to unrelated existing changes, isolate the failure and report it without broad cleanup.
4. Prefer keeping implementation inside assembly/admin packages; only touch kernel if the implementation is impossible without a small helper.
5. After each task, run the task-specific tests before moving to the next task.
