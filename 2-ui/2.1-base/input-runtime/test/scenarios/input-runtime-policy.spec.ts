import {describe, expect, it} from 'vitest'
import {usesVirtualKeyboard} from '../../src'

describe('input policy', () => {
    it('uses system keyboard unless virtual keyboard is explicitly declared', () => {
        expect(usesVirtualKeyboard('system-text')).toBe(false)
        expect(usesVirtualKeyboard('system-number')).toBe(false)
        expect(usesVirtualKeyboard('virtual-pin')).toBe(true)
        expect(usesVirtualKeyboard('virtual-amount')).toBe(true)
    })
})
