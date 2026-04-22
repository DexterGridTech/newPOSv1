import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {
    applyVirtualKeyToValue,
    createInputController,
    shouldRestoreInputValue,
    toPersistedInputValue,
    useInputController,
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
        expect(applyVirtualKeyToValue('12.3', '-', 'virtual-amount')).toBe('-12.3')
        expect(applyVirtualKeyToValue('-12.3', '-', 'virtual-amount')).toBe('12.3')
        expect(applyVirtualKeyToValue('ab', 'C', 'virtual-activation-code')).toBe('abC')
        expect(applyVirtualKeyToValue('ACT', '-', 'virtual-activation-code')).toBe('ACT-')
        expect(applyVirtualKeyToValue('sand', 'B', 'virtual-identifier')).toBe('sandB')
        expect(applyVirtualKeyToValue('sandbox', '-', 'virtual-identifier')).toBe('sandbox-')
        expect(applyVirtualKeyToValue('{"a"', ':', 'virtual-json')).toBe('{"a":')
        expect(applyVirtualKeyToValue('{"a":1', '}', 'virtual-json')).toBe('{"a":1}')
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

    it('syncs controller behavior when hook inputs change over time', () => {
        let latest: ReturnType<typeof useInputController> | null = null

        const HookProbe: React.FC<{
            mode: 'virtual-pin' | 'virtual-activation-code'
            maxLength?: number
        }> = ({mode, maxLength}) => {
            latest = useInputController({
                mode,
                maxLength,
            })
            return null
        }

        let renderer!: TestRenderer.ReactTestRenderer
        act(() => {
            renderer = TestRenderer.create(
                React.createElement(HookProbe, {
                    mode: 'virtual-pin',
                    maxLength: 2,
                }),
            )
        })

        act(() => {
            latest?.applyVirtualKey('1')
            latest?.applyVirtualKey('2')
            latest?.applyVirtualKey('3')
        })

        expect(latest?.state.value).toBe('12')

        act(() => {
            renderer.update(React.createElement(HookProbe, {
                mode: 'virtual-activation-code',
                maxLength: 4,
            }))
        })

        act(() => {
            latest?.clear()
            latest?.applyVirtualKey('A')
            latest?.applyVirtualKey('B')
            latest?.applyVirtualKey('C')
            latest?.applyVirtualKey('D')
            latest?.applyVirtualKey('E')
        })

        expect(latest?.state.mode).toBe('virtual-activation-code')
        expect(latest?.state.maxLength).toBe(4)
        expect(latest?.state.value).toBe('ABCD')
    })

    it('keeps hook action references stable across rerenders', () => {
        const snapshots: Array<ReturnType<typeof useInputController>> = []

        const HookProbe: React.FC<{
            mode: 'virtual-pin'
            maxLength?: number
            initialValue?: string
        }> = input => {
            snapshots.push(useInputController(input))
            return null
        }

        let renderer!: TestRenderer.ReactTestRenderer
        act(() => {
            renderer = TestRenderer.create(
                React.createElement(HookProbe, {
                    mode: 'virtual-pin',
                    maxLength: 6,
                    initialValue: '1',
                }),
            )
        })

        act(() => {
            renderer.update(React.createElement(HookProbe, {
                mode: 'virtual-pin',
                maxLength: 6,
                initialValue: '1',
            }))
        })

        expect(snapshots).toHaveLength(2)
        expect(snapshots[1]?.setValue).toBe(snapshots[0]?.setValue)
        expect(snapshots[1]?.applyVirtualKey).toBe(snapshots[0]?.applyVirtualKey)
        expect(snapshots[1]?.clear).toBe(snapshots[0]?.clear)
    })
})
