import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import {InputField, InputRuntimeProvider, PinInputField, VirtualKeyboardOverlay} from '../../src'
import {createInputHarness, renderWithStore} from '../support/inputHarness'

vi.mock('react-native', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('react-native')>('react-native')

    return {
        ...actual,
        TextInput: (props: Record<string, unknown>) => ReactModule.createElement('mock-text-input', props),
    }
})

describe('input-runtime rendered components', () => {
    it('renders dedicated virtual-keyboard fields and overlay', async () => {
        const harness = await createInputHarness()
        let value = '123456'
        const tree = renderWithStore(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value={value}
                        onChangeText={(next) => {
                            value = next
                        }}
                        mode="virtual-pin"
                        secureTextEntry
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        expect(tree.toJSON()).toBeTruthy()
    })

    it('opens virtual keyboard from a virtual field and writes keys back through provider', async () => {
        const harness = await createInputHarness()
        let value = ''
        const tree = renderWithStore(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value={value}
                        onChangeText={(next) => {
                            value = next
                        }}
                        mode="virtual-pin"
                        secureTextEntry
                        maxLength={6}
                        placeholder="请输入 PIN"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-virtual-field:virtual-pin'}).props.onPress()
        })

        expect(() => tree.root.findByProps({testID: 'ui-base-virtual-keyboard'})).not.toThrow()

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:1'}).props.onPress()
            tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:2'}).props.onPress()
            tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:backspace'}).props.onPress()
        })

        expect(value).toBe('1')
    })

    it('renders centered preview text and pressable feedback styles for the virtual keyboard', async () => {
        const harness = await createInputHarness()
        const tree = renderWithStore(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value="12"
                        onChangeText={() => {}}
                        mode="virtual-pin"
                        secureTextEntry
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-virtual-field:virtual-pin'}).props.onPress()
        })

        const title = tree.root.findByProps({testID: 'ui-base-virtual-keyboard:title'})
        const value = tree.root.findByProps({testID: 'ui-base-virtual-keyboard:value'})
        const closeKey = tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:close'})
        const digitKey = tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:1'})
        const enterKey = tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:enter'})
        const previewContainer = title.parent?.parent
        expect(previewContainer).toBeTruthy()

        expect(title.props.style.textAlign).toBe('center')
        expect(value.props.style.textAlign).toBe('center')
        expect(previewContainer?.props.style.borderWidth).toBe(1)
        expect(previewContainer?.props.style.borderRadius).toBe(16)
        expect(typeof closeKey.props.style).toBe('function')
        expect(typeof digitKey.props.style).toBe('function')
        expect(typeof enterKey.props.style).toBe('function')
    })

    it('uses a narrower max width for numeric keyboards than activation keyboards', async () => {
        const harness = await createInputHarness()

        const pinTree = renderWithStore(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value=""
                        onChangeText={() => {}}
                        mode="virtual-pin"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            pinTree.root.findByProps({testID: 'ui-base-virtual-field:virtual-pin'}).props.onPress()
        })

        const pinKeyboard = pinTree.root.findByProps({testID: 'ui-base-virtual-keyboard'})
        expect(pinKeyboard.props.style.maxWidth).toBe(360)

        const activationTree = renderWithStore(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value=""
                        onChangeText={() => {}}
                        mode="virtual-activation-code"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            activationTree.root.findByProps({testID: 'ui-base-virtual-field:virtual-activation-code'}).props.onPress()
        })

        const activationKeyboard = activationTree.root.findByProps({testID: 'ui-base-virtual-keyboard'})
        expect(activationKeyboard.props.style.maxWidth).toBe(520)
    })

    it('reduces the amount keyboard to four rows and removes clear or minus keys', async () => {
        const harness = await createInputHarness()
        const tree = renderWithStore(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value=""
                        onChangeText={() => {}}
                        mode="virtual-amount"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-virtual-field:virtual-amount'}).props.onPress()
        })

        expect(() => tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:0'})).not.toThrow()
        expect(() => tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:.'})).not.toThrow()
        expect(() => tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:backspace'})).not.toThrow()
        expect(() => tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:clear'})).toThrow()
        expect(() => tree.root.findByProps({testID: 'ui-base-virtual-keyboard:key:-'})).toThrow()
    })

    it('keeps unspecified fields on the system keyboard path', async () => {
        const harness = await createInputHarness()
        const tree = renderWithStore(
            <InputRuntimeProvider>
                <InputField
                    value="abc"
                    onChangeText={() => {}}
                    placeholder="系统输入"
                />
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        expect(() => tree.root.findByProps({testID: 'ui-base-system-field:system-text'})).not.toThrow()
    })
})
