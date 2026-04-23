import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    hideLoadingMock,
    loggerLogMock,
} = vi.hoisted(() => ({
    hideLoadingMock: vi.fn(async () => undefined),
    loggerLogMock: vi.fn(),
}))

vi.mock('../../src/turbomodules', () => ({
    nativeAppControl: {
        hideLoading: hideLoadingMock,
    },
    nativeLogger: {
        log: loggerLogMock,
    },
}))

import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {reportAppLoadComplete} from '../../src/application/reportAppLoadComplete'
import {syncHotUpdateStateFromNativeBoot} from '../../src/application/syncHotUpdateStateFromNativeBoot'
import {releaseInfo} from '../../src/generated/releaseInfo'

const embeddedRelease = {
    appId: releaseInfo.appId,
    assemblyVersion: releaseInfo.assemblyVersion,
    buildNumber: releaseInfo.buildNumber,
    runtimeVersion: releaseInfo.runtimeVersion,
    bundleVersion: releaseInfo.bundleVersion,
}

describe('assembly report app load complete', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('notifies native startup coordinator and delegates hot-update reconciliation to public commands', async () => {
        const dispatchCommand = vi.fn(async () => ({
            status: 'COMPLETED',
            actorResults: [{result: {terminalState: 'RUNNING'}}],
        }))

        const result = await reportAppLoadComplete({
            dispatchCommand,
        } as any, 1)

        expect(hideLoadingMock).toHaveBeenCalledTimes(1)
        expect(hideLoadingMock).toHaveBeenCalledWith(1)
        expect(loggerLogMock).toHaveBeenCalledTimes(2)
        expect(loggerLogMock.mock.calls[0]?.[0]).toBe('assembly.android.mixc-retail-rn84.boot')
        expect(loggerLogMock.mock.calls[1]?.[0]).toBe('assembly.android.mixc-retail-rn84.boot')
        expect(loggerLogMock.mock.calls[0]?.[1]).toContain('"stage":"app-load-complete:start"')
        expect(loggerLogMock.mock.calls[1]?.[1]).toContain('"stage":"app-load-complete:done"')
        expect(result).toEqual({terminalState: 'RUNNING'})
        expect(dispatchCommand).toHaveBeenNthCalledWith(1, createCommand(
            tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
            {
                embeddedRelease,
                initializeEmbeddedCurrent: false,
                previousCurrent: undefined,
            },
        ))
        expect(dispatchCommand).toHaveBeenNthCalledWith(2, createCommand(
            tdpSyncV2CommandDefinitions.confirmHotUpdateLoadComplete,
            {
                embeddedRelease,
                displayIndex: 1,
            },
        ))
    })

    it('does not confirm load complete when boot reconciliation reports rollback', async () => {
        const dispatchCommand = vi.fn(async () => ({
            status: 'COMPLETED',
            actorResults: [{
                result: {
                    terminalState: 'ROLLED_BACK',
                    reason: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
                },
            }],
        }))

        const result = await reportAppLoadComplete({
            dispatchCommand,
        } as any, 0)

        expect(result).toEqual({
            terminalState: 'ROLLED_BACK',
            reason: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
        })
        expect(dispatchCommand).toHaveBeenCalledTimes(1)
        expect(loggerLogMock.mock.calls[1]?.[1]).toContain('"terminalState":"ROLLED_BACK"')
    })

    it('syncs boot state through the tdp-sync-runtime-v2 public command', async () => {
        const dispatchCommand = vi.fn(async () => ({
            status: 'COMPLETED',
            actorResults: [{
                result: {
                    terminalState: 'RUNNING',
                    source: 'hot-update',
                },
            }],
        }))

        const result = await syncHotUpdateStateFromNativeBoot({
            dispatchCommand,
        } as any)

        expect(result).toEqual({
            terminalState: 'RUNNING',
            source: 'hot-update',
        } as any)
        expect(dispatchCommand).toHaveBeenCalledWith(createCommand(
            tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
            {
                embeddedRelease,
                initializeEmbeddedCurrent: true,
                previousCurrent: undefined,
            },
        ))
    })

    it('passes previous hot-update current through the public reset command payload', async () => {
        const dispatchCommand = vi.fn(async () => ({
            status: 'COMPLETED',
            actorResults: [{result: {terminalState: 'RUNNING'}}],
        }))
        const previousCurrent = {
            source: 'hot-update' as const,
            appId: releaseInfo.appId,
            assemblyVersion: releaseInfo.assemblyVersion,
            buildNumber: releaseInfo.buildNumber,
            runtimeVersion: releaseInfo.runtimeVersion,
            bundleVersion: '1.0.0+ota.6',
            packageId: 'pkg-6',
            releaseId: 'rel-6',
            installDir: '/tmp/pkg-6',
            appliedAt: 123,
        }

        await syncHotUpdateStateFromNativeBoot({
            dispatchCommand,
        } as any, {
            initializeEmbeddedCurrent: false,
            previousState: {
                'kernel.base.tdp-sync-runtime-v2.hot-update': {
                    current: previousCurrent,
                    history: [],
                },
            } as any,
        })

        expect(dispatchCommand).toHaveBeenCalledWith(createCommand(
            tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
            {
                embeddedRelease,
                initializeEmbeddedCurrent: false,
                previousCurrent,
            },
        ))
    })
})
