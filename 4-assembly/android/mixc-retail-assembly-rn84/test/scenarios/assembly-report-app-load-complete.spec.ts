import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    hideLoadingMock,
    loggerLogMock,
    readActiveMarkerMock,
    readBootMarkerMock,
    readRollbackMarkerMock,
    clearBootMarkerMock,
    confirmLoadCompleteMock,
} = vi.hoisted(() => ({
    hideLoadingMock: vi.fn(async () => undefined),
    loggerLogMock: vi.fn(),
    readActiveMarkerMock: vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null),
    readBootMarkerMock: vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null),
    readRollbackMarkerMock: vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null),
    clearBootMarkerMock: vi.fn(async () => undefined),
    confirmLoadCompleteMock: vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null),
}))

vi.mock('../../src/turbomodules', () => ({
    nativeAppControl: {
        hideLoading: hideLoadingMock,
    },
    nativeLogger: {
        log: loggerLogMock,
    },
}))

vi.mock('../../src/turbomodules/hotUpdate', () => ({
    nativeHotUpdate: {
        readActiveMarker: readActiveMarkerMock,
        readBootMarker: readBootMarkerMock,
        readRollbackMarker: readRollbackMarkerMock,
        clearBootMarker: clearBootMarkerMock,
        confirmLoadComplete: confirmLoadCompleteMock,
    },
}))

import {reportAppLoadComplete} from '../../src/application/reportAppLoadComplete'
import {syncHotUpdateStateFromNativeBoot} from '../../src/application/syncHotUpdateStateFromNativeBoot'

describe('assembly report app load complete', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('notifies native startup coordinator through hideLoading and emits boot logs', async () => {
        const result = await reportAppLoadComplete({
            getState: vi.fn(() => ({})),
            getStore: vi.fn(() => ({
                dispatch: vi.fn(),
            })),
        } as any, 1)

        expect(hideLoadingMock).toHaveBeenCalledTimes(1)
        expect(hideLoadingMock).toHaveBeenCalledWith(1)
        expect(loggerLogMock).toHaveBeenCalledTimes(2)
        expect(loggerLogMock.mock.calls[0]?.[0]).toBe('assembly.android.mixc-retail-rn84.boot')
        expect(loggerLogMock.mock.calls[1]?.[0]).toBe('assembly.android.mixc-retail-rn84.boot')
        expect(loggerLogMock.mock.calls[0]?.[1]).toContain('"stage":"app-load-complete:start"')
        expect(loggerLogMock.mock.calls[1]?.[1]).toContain('"stage":"app-load-complete:done"')
        expect(result).toEqual({terminalState: 'RUNNING'})
        expect(readRollbackMarkerMock).toHaveBeenCalledTimes(1)
        expect(confirmLoadCompleteMock).toHaveBeenCalledTimes(1)
        expect(readActiveMarkerMock).toHaveBeenCalledTimes(1)
        expect(clearBootMarkerMock).not.toHaveBeenCalled()
    })

    it('marks hot update applied when native confirms active package on load complete', async () => {
        const dispatch = vi.fn()
        confirmLoadCompleteMock.mockResolvedValueOnce({
            bundleVersion: '1.0.0+ota.3',
            installDir: '/data/user/0/app/files/hot-updates/packages/pkg-3',
            packageId: 'pkg-3',
            releaseId: 'rel-3',
        })

        const result = await reportAppLoadComplete({
            getState: vi.fn(() => ({})),
            getStore: vi.fn(() => ({dispatch})),
        } as any, 0)

        expect(result).toEqual({terminalState: 'RUNNING'})
        expect(dispatch).toHaveBeenCalledTimes(1)
        expect(dispatch.mock.calls[0]?.[0]?.type).toContain('markApplied')
    })

    it('marks rollback and returns rolled back state when native reports rollback marker', async () => {
        const dispatch = vi.fn()
        readRollbackMarkerMock.mockResolvedValueOnce({
            rollbackReason: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
            packageId: 'pkg-bad',
            releaseId: 'rel-bad',
        })

        const result = await reportAppLoadComplete({
            getState: vi.fn(() => ({})),
            getStore: vi.fn(() => ({dispatch})),
        } as any, 0)

        expect(result).toEqual({
            terminalState: 'ROLLED_BACK',
            reason: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
        })
        expect(confirmLoadCompleteMock).not.toHaveBeenCalled()
        expect(dispatch).toHaveBeenCalledTimes(2)
        expect(dispatch.mock.calls[0]?.[0]?.type).toContain('markApplied')
        expect(dispatch.mock.calls[1]?.[0]?.type).toContain('markFailed')
    })

    it('syncs boot state from native active marker before load-complete', async () => {
        const dispatch = vi.fn()
        readActiveMarkerMock.mockResolvedValueOnce({
            bundleVersion: '1.0.0+ota.5',
            installDir: '/tmp/pkg-5',
            packageId: 'pkg-5',
            releaseId: 'rel-5',
        })

        const result = await syncHotUpdateStateFromNativeBoot({
            getState: vi.fn(() => ({})),
            getStore: vi.fn(() => ({dispatch})),
        } as any)

        expect(result).toBeNull()
        expect(dispatch).toHaveBeenCalledTimes(1)
        expect(dispatch.mock.calls[0]?.[0]?.type).toContain('markApplied')
    })
})
