import {describe, expect, it} from 'vitest'
import {
    applyVirtualKeyToValue,
    createInputController,
    shouldRestoreInputValue,
    toPersistedInputValue,
} from '../../src'

describe('input controller', () => {
    it('keeps field truth in the controller and applies virtual keys', () => {
        const controller = createInputController({
            value: '',
            mode: 'virtual-pin',
            persistence: 'transient',
            maxLength: 6,
        })

        controller.applyVirtualKey('1')
        controller.applyVirtualKey('2')
        controller.applyVirtualKey('backspace')

        expect(controller.getState().value).toBe('1')
    })

    it('normalizes amount and activation-code virtual keys', () => {
        expect(applyVirtualKeyToValue('', '.', 'virtual-amount')).toBe('0.')
        expect(applyVirtualKeyToValue('12.', '.', 'virtual-amount')).toBe('12.')
        expect(applyVirtualKeyToValue('ab', 'C', 'virtual-activation-code')).toBe('abC')
        expect(applyVirtualKeyToValue('123456', '7', 'virtual-pin', 6)).toBe('123456')
    })

    it('persists only explicitly recoverable values', () => {
        expect(shouldRestoreInputValue('recoverable')).toBe(true)
        expect(shouldRestoreInputValue('transient')).toBe(false)
        expect(shouldRestoreInputValue('secure-never-persist')).toBe(false)

        expect(toPersistedInputValue({
            value: 'abc',
            mode: 'system-text',
            persistence: 'recoverable',
        })).toBe('abc')

        expect(toPersistedInputValue({
            value: 'secret',
            mode: 'system-password',
            persistence: 'secure-never-persist',
        })).toBeNull()
    })
})
