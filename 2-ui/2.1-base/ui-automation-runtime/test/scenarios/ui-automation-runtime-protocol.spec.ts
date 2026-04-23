import {describe, expect, it} from 'vitest'
import {
    AUTOMATION_PROTOCOL_VERSION,
    assertValidTarget,
    assertWaitTarget,
    isSideEffectMethod,
} from '../../src/foundations/protocol'

describe('ui automation runtime protocol rules', () => {
    it('pins the protocol version', () => {
        expect(AUTOMATION_PROTOCOL_VERSION).toBe(1)
    })

    it('allows all only for readonly broadcast methods', () => {
        expect(assertValidTarget('runtime.getInfo', 'all')).toBe('all')
        expect(() => assertValidTarget('command.dispatch', 'all')).toThrow(/all target/i)
        expect(() => assertValidTarget('scripts.execute', 'all')).toThrow(/all target/i)
    })

    it('rejects all for wait methods', () => {
        expect(() => assertWaitTarget('all')).toThrow(/wait target/i)
    })

    it('classifies side effect methods', () => {
        expect(isSideEffectMethod('command.dispatch')).toBe(true)
        expect(isSideEffectMethod('scripts.execute')).toBe(true)
        expect(isSideEffectMethod('runtime.getState')).toBe(false)
    })
})
