import {describe, expect, it, vi} from 'vitest'

const {
    bootstrapAssemblyRuntimeMock,
    syncHotUpdateStateFromNativeBootMock,
} = vi.hoisted(() => ({
    bootstrapAssemblyRuntimeMock: vi.fn(async () => undefined),
    syncHotUpdateStateFromNativeBootMock: vi.fn(async () => null),
}))

vi.mock('../../src/application/bootstrapRuntime', () => ({
    bootstrapAssemblyRuntime: bootstrapAssemblyRuntimeMock,
}))

vi.mock('../../src/application/syncHotUpdateStateFromNativeBoot', () => ({
    syncHotUpdateStateFromNativeBoot: syncHotUpdateStateFromNativeBootMock,
}))

import {runtimeShellV2CommandDefinitions} from '@impos2/kernel-base-runtime-shell-v2'
import {createModule} from '../../src/application/createModule'
import {assemblyRuntimeModuleManifest} from '../../src/application/moduleManifest'
import {releaseInfo} from '../../src/generated/releaseInfo'

describe('assembly runtime module', () => {
    it('uses release info as runtime module package version source', () => {
        expect(assemblyRuntimeModuleManifest.moduleName).toBe('assembly.android.mixc-catering-rn84')
        expect(assemblyRuntimeModuleManifest.packageVersion).toBe(releaseInfo.assemblyVersion)
    })

    it('bootstraps assembly runtime on initialize', async () => {
        const module = createModule({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 1,
            isEmulator: false,
            topology: {
                role: 'slave',
                localNodeId: 'master:device-001:display-1',
                masterNodeId: 'master:device-001',
                wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
                httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            },
        })

        const handler = module.actorDefinitions?.[0]?.handlers.find(item =>
            item.commandName === runtimeShellV2CommandDefinitions.initialize.commandName,
        )

        expect(handler).toBeDefined()
        await handler?.handle({
            dispatchCommand: vi.fn(async () => ({status: 'COMPLETED'})),
        } as any)

        expect(bootstrapAssemblyRuntimeMock).toHaveBeenCalledTimes(1)
        const bootstrapProps = (bootstrapAssemblyRuntimeMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1]
        expect(bootstrapProps).toMatchObject({
            deviceId: 'device-001',
            displayIndex: 1,
            topology: {
                role: 'slave',
            },
        })
    })

    it('re-syncs hot update current facts after runtime reset', async () => {
        const module = createModule({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: false,
        })
        const context = {
            getState: vi.fn(() => ({})),
            getStore: vi.fn(() => ({dispatch: vi.fn()})),
        }

        await module.onApplicationReset?.(context as any, {reason: 'kernel.base.tcp-control-runtime-v2.deactivateTerminal'})

        expect(syncHotUpdateStateFromNativeBootMock).toHaveBeenCalledTimes(1)
        expect(syncHotUpdateStateFromNativeBootMock).toHaveBeenCalledWith(context, {
            initializeEmbeddedCurrent: false,
            previousState: undefined,
        })
    })
})
