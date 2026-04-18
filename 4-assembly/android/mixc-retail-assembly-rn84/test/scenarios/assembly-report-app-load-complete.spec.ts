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

import {reportAppLoadComplete} from '../../src/application/reportAppLoadComplete'

describe('assembly report app load complete', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('notifies native startup coordinator through hideLoading and emits boot logs', async () => {
        await reportAppLoadComplete(1)

        expect(hideLoadingMock).toHaveBeenCalledTimes(1)
        expect(hideLoadingMock).toHaveBeenCalledWith(1)
        expect(loggerLogMock).toHaveBeenCalledTimes(2)
        expect(loggerLogMock.mock.calls[0]?.[0]).toBe('assembly.android.mixc-retail-rn84.boot')
        expect(loggerLogMock.mock.calls[1]?.[0]).toBe('assembly.android.mixc-retail-rn84.boot')
        expect(loggerLogMock.mock.calls[0]?.[1]).toContain('"stage":"app-load-complete:start"')
        expect(loggerLogMock.mock.calls[1]?.[1]).toContain('"stage":"app-load-complete:done"')
    })
})
