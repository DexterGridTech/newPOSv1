import {describe, expect, it, vi} from 'vitest'

const {
    bootstrapAssemblyRuntimeMock,
    nativeAddPowerStatusChangeListenerMock,
} = vi.hoisted(() => ({
    bootstrapAssemblyRuntimeMock: vi.fn(async () => undefined),
    nativeAddPowerStatusChangeListenerMock: vi.fn(() => () => undefined),
}))

vi.mock('../../src/application/bootstrapRuntime', () => ({
    bootstrapAssemblyRuntime: bootstrapAssemblyRuntimeMock,
}))

vi.mock('../../src/turbomodules/device', () => ({
    nativeDevice: {
        addPowerStatusChangeListener: nativeAddPowerStatusChangeListenerMock,
    },
}))

import {runtimeShellV2CommandDefinitions} from '@impos2/kernel-base-runtime-shell-v2'
import {createModule} from '../../src/application/createModule'
import {assemblyRuntimeModuleManifest} from '../../src/application/moduleManifest'
import {releaseInfo} from '../../src/generated/releaseInfo'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'

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

    it('listens for power changes and switches standalone slave display mode', async () => {
        let powerListener: ((event: Record<string, unknown>) => void) | undefined
        nativeAddPowerStatusChangeListenerMock.mockImplementation(((...args: any[]) => {
            powerListener = args[0]
            return () => undefined
        }) as any)

        const module = createModule({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: false,
        })
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        module.install?.({
            platformPorts: {
                device: undefined,
                logger: {
                    info: vi.fn(),
                    debug: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                    scope: vi.fn(() => ({
                        info: vi.fn(),
                        debug: vi.fn(),
                        warn: vi.fn(),
                        error: vi.fn(),
                    })),
                },
            },
            getState: () => ({
                'kernel.base.topology-runtime-v3.context': {
                    standalone: true,
                    instanceMode: 'SLAVE',
                    displayMode: 'PRIMARY',
                    enableSlave: false,
                },
            }),
            dispatchCommand,
            displayContext: {displayIndex: 0, displayCount: 1},
        } as any)

        expect(nativeAddPowerStatusChangeListenerMock).toHaveBeenCalledTimes(1)
        expect(powerListener).toBeTypeOf('function')

        await powerListener?.({powerConnected: true})

        expect(dispatchCommand).toHaveBeenCalledWith(expect.objectContaining({
            definition: expect.objectContaining({
                commandName: topologyRuntimeV3CommandDefinitions.setDisplayMode.commandName,
            }),
            payload: {displayMode: 'SECONDARY'},
        }))
    })
})
