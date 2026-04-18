import {describe, expect, it, vi} from 'vitest'

const {
    bootstrapAssemblyRuntimeMock,
} = vi.hoisted(() => ({
    bootstrapAssemblyRuntimeMock: vi.fn(async () => undefined),
}))

vi.mock('../../src/application/bootstrapRuntime', () => ({
    bootstrapAssemblyRuntime: bootstrapAssemblyRuntimeMock,
}))

import {runtimeShellV2CommandDefinitions} from '@impos2/kernel-base-runtime-shell-v2'
import {createModule} from '../../src/application/createModule'
import {assemblyRuntimeModuleManifest} from '../../src/application/moduleManifest'
import {releaseInfo} from '../../src/generated/releaseInfo'

describe('assembly runtime module', () => {
    it('uses release info as runtime module package version source', () => {
        expect(assemblyRuntimeModuleManifest.moduleName).toBe('assembly.android.mixc-retail-rn84')
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
                ticketToken: 'ticket-001',
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
})
