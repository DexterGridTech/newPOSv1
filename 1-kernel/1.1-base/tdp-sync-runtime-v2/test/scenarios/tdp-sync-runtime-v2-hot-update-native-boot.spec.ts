import {describe, expect, it, vi} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    selectTdpHotUpdateState,
    tdpSyncV2CommandDefinitions,
} from '../../src'

const createRuntime = (input: {
    hotUpdatePort?: Record<string, unknown>
}) => createKernelRuntimeV2({
    localNodeId: createNodeId(),
    platformPorts: createPlatformPorts({
        environmentMode: 'DEV',
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write() {},
            scope: {
                moduleName: 'kernel.base.tdp-sync-runtime-v2.test.native-boot',
                layer: 'kernel',
            },
        }),
        stateStorage: {
            async getItem() {
                return null
            },
            async setItem() {},
            async removeItem() {},
        },
        secureStateStorage: {
            async getItem() {
                return null
            },
            async setItem() {},
            async removeItem() {},
        },
        hotUpdate: input.hotUpdatePort as any,
    }),
    modules: [
        createTcpControlRuntimeModuleV2(),
        createTdpSyncRuntimeModuleV2(),
    ],
    displayContext: {
        displayIndex: 0,
        displayCount: 1,
    },
})

const embeddedRelease = {
    appId: 'assembly-android-mixc-retail-rn84',
    assemblyVersion: '1.0.0',
    buildNumber: 5,
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    bundleVersion: '1.0.0+ota.5',
}

describe('tdp-sync-runtime-v2 native hot-update reconciliation', () => {
    it('marks rollback through public boot reconciliation command', async () => {
        const runtime = createRuntime({
            hotUpdatePort: {
                readRollbackMarker: vi.fn(async () => ({
                    rollbackReason: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
                })),
            },
        })

        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
            {
                embeddedRelease,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(result.actorResults[0]?.result).toMatchObject({
            terminalState: 'ROLLED_BACK',
            reason: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
        })
        expect(selectTdpHotUpdateState(runtime.getState())).toMatchObject({
            current: {
                source: 'rollback',
                bundleVersion: embeddedRelease.bundleVersion,
            },
            lastError: {
                code: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
            },
        })
    })

    it('marks active hot-update package through public boot reconciliation command', async () => {
        const runtime = createRuntime({
            hotUpdatePort: {
                readRollbackMarker: vi.fn(async () => null),
                readActiveMarker: vi.fn(async () => ({
                    bundleVersion: '1.0.0+ota.6',
                    installDir: '/tmp/pkg-6',
                    packageId: 'pkg-6',
                    releaseId: 'rel-6',
                })),
            },
        })

        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
            {
                embeddedRelease,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(selectTdpHotUpdateState(runtime.getState())?.current).toMatchObject({
            source: 'hot-update',
            bundleVersion: '1.0.0+ota.6',
            installDir: '/tmp/pkg-6',
            packageId: 'pkg-6',
            releaseId: 'rel-6',
        })
    })

    it('restores previous hot-update current on reset fallback without assembly mutating slice directly', async () => {
        const runtime = createRuntime({
            hotUpdatePort: {
                readRollbackMarker: vi.fn(async () => null),
                readActiveMarker: vi.fn(async () => null),
            },
        })

        await runtime.start()

        const previousCurrent = {
            source: 'hot-update' as const,
            appId: embeddedRelease.appId,
            assemblyVersion: embeddedRelease.assemblyVersion,
            buildNumber: embeddedRelease.buildNumber,
            runtimeVersion: embeddedRelease.runtimeVersion,
            bundleVersion: '1.0.0+ota.9',
            packageId: 'pkg-9',
            releaseId: 'rel-9',
            installDir: '/tmp/pkg-9',
            appliedAt: 123,
        }

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
            {
                embeddedRelease,
                initializeEmbeddedCurrent: false,
                previousCurrent,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(selectTdpHotUpdateState(runtime.getState())?.current).toMatchObject(previousCurrent)
    })

    it('confirms load complete through public command and updates current package', async () => {
        const confirmLoadComplete = vi.fn(async () => ({
            bundleVersion: '1.0.0+ota.7',
            installDir: '/tmp/pkg-7',
            packageId: 'pkg-7',
            releaseId: 'rel-7',
        }))
        const runtime = createRuntime({
            hotUpdatePort: {
                confirmLoadComplete,
            },
        })

        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.confirmHotUpdateLoadComplete,
            {
                embeddedRelease,
                displayIndex: 0,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(confirmLoadComplete).toHaveBeenCalledWith({displayIndex: 0})
        expect(selectTdpHotUpdateState(runtime.getState())?.current).toMatchObject({
            source: 'hot-update',
            bundleVersion: '1.0.0+ota.7',
            installDir: '/tmp/pkg-7',
            packageId: 'pkg-7',
            releaseId: 'rel-7',
        })
    })
})
