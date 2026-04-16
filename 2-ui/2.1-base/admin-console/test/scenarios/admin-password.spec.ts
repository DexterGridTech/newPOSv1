import {describe, expect, it} from 'vitest'
import {createAdminPasswordVerifier} from '../../src'

describe('admin password verifier', () => {
    it('accepts current, previous, and next hour windows', () => {
        const verifier = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
            nowProvider: () => new Date('2026-04-15T10:30:00+08:00'),
        })

        const current = verifier.deriveFor(new Date('2026-04-15T10:00:00+08:00'))
        const previous = verifier.deriveFor(new Date('2026-04-15T09:00:00+08:00'))
        const next = verifier.deriveFor(new Date('2026-04-15T11:00:00+08:00'))

        expect(verifier.verify(current)).toBe(true)
        expect(verifier.verify(previous)).toBe(true)
        expect(verifier.verify(next)).toBe(true)
        expect(verifier.verify('000000')).toBe(false)
    })
})
