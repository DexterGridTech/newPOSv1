import {beforeEach, describe, expect, it} from 'vitest'
import {
    getAssemblySelectedServerSpace,
    getAssemblyServerSpaceSnapshot,
    resetAssemblyServerSpaceStateForTests,
    resolveAssemblyTransportServers,
    setAssemblySelectedServerSpace,
} from '../../src/platform-ports/serverSpaceState'

describe('assembly server space state', () => {
    beforeEach(() => {
        resetAssemblyServerSpaceStateForTests()
    })

    it('uses dev config as the default selected space', () => {
        const snapshot = getAssemblyServerSpaceSnapshot()

        expect(snapshot.selectedSpace).toBe('kernel-base-dev')
        expect(snapshot.availableSpaces).toContain('kernel-base-dev')
        expect(getAssemblySelectedServerSpace().name).toBe('kernel-base-dev')
    })

    it('applies runtime baseUrl override to the selected mock terminal platform server', () => {
        const servers = resolveAssemblyTransportServers({
            mockTerminalPlatformBaseUrl: 'http://127.0.0.1:9100',
        })

        const mockTerminalPlatform = servers.find(item => item.serverName === 'mock-terminal-platform')
        expect(mockTerminalPlatform?.addresses[0]?.baseUrl).toBe('http://127.0.0.1:9100')
    })

    it('rejects unknown runtime server spaces', () => {
        expect(() => setAssemblySelectedServerSpace('unknown-space')).toThrow(
            'Unknown assembly server space: unknown-space',
        )
    })
})
