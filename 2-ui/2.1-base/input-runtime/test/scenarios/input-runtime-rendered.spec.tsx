import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {InputField, InputRuntimeProvider, VirtualKeyboardOverlay} from '../../src'
import {createInputHarness} from '../support/inputHarness'
import {renderWithAutomation} from '../../../runtime-react/test/support/runtimeReactHarness'

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
        const tree = renderWithAutomation(
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

        await expect(tree.getNode('ui-base-virtual-field:virtual-pin')).resolves.toMatchObject({
            role: 'button',
        })
        await expect(tree.queryNodes('ui-base-virtual-keyboard')).resolves.toHaveLength(0)
        expect(value).toBe('123456')
    })

    it('opens virtual keyboard from a virtual field and writes keys back through provider', async () => {
        const harness = await createInputHarness()
        let value = ''
        const onChangeText = vi.fn((next: string) => {
            value = next
        })
        const automation = renderWithAutomation(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value={value}
                        onChangeText={onChangeText}
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

        await automation.press('ui-base-virtual-field:virtual-pin')
        await automation.waitForNode('ui-base-virtual-keyboard')

        await automation.press('ui-base-virtual-keyboard:key:1')
        await automation.press('ui-base-virtual-keyboard:key:2')
        await automation.press('ui-base-virtual-keyboard:key:backspace')
        await automation.waitForIdle()

        expect(value).toBe('1')
        expect(onChangeText).toHaveBeenCalledTimes(3)
        expect(onChangeText).toHaveBeenNthCalledWith(1, '1')
        expect(onChangeText).toHaveBeenNthCalledWith(2, '12')
        expect(onChangeText).toHaveBeenNthCalledWith(3, '1')
    })

    it('rejects ui.setValue on virtual fields so automation must use keyboard keys', async () => {
        const harness = await createInputHarness()
        let value = ''
        const automation = renderWithAutomation(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value={value}
                        onChangeText={(next) => {
                            value = next
                        }}
                        mode="virtual-activation-code"
                        placeholder="请输入激活码"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await expect(automation.client.call('ui.setValue', {
            target: 'primary',
            nodeId: 'ui-base-virtual-field:virtual-activation-code',
            value: 'ABC123',
        })).rejects.toThrow('NODE_NOT_ACTIONABLE')
        await expect(automation.queryNodes('ui-base-virtual-keyboard')).resolves.toHaveLength(0)
        expect(value).toBe('')
    })

    it('rejects helper changeText on virtual fields with an explicit keyboard-only error', async () => {
        const harness = await createInputHarness()
        const automation = renderWithAutomation(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value=""
                        onChangeText={() => {}}
                        mode="virtual-pin"
                        placeholder="请输入 PIN"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await expect(automation.changeText(
            'ui-base-virtual-field:virtual-pin',
            '123456',
        )).rejects.toThrow('VIRTUAL_INPUT_REQUIRES_KEYBOARD:ui-base-virtual-field:virtual-pin')
    })

    it('exposes virtual keyboard preview and primary keys through automation nodes', async () => {
        const harness = await createInputHarness()
        const tree = renderWithAutomation(
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

        await tree.press('ui-base-virtual-field:virtual-pin')

        await expect(tree.getText('ui-base-virtual-keyboard:title')).resolves.toBe('PIN 键盘')
        await expect(tree.getText('ui-base-virtual-keyboard:value')).resolves.toBe('••')
        await expect(tree.getNode('ui-base-virtual-keyboard:key:close')).resolves.toMatchObject({
            role: 'button',
        })
        await expect(tree.getNode('ui-base-virtual-keyboard:key:1')).resolves.toMatchObject({
            role: 'button',
        })
        await expect(tree.getNode('ui-base-virtual-keyboard:key:enter')).resolves.toMatchObject({
            role: 'button',
        })
    })

    it('switches keyboard semantics between numeric and activation modes', async () => {
        const harness = await createInputHarness()

        const pinTree = renderWithAutomation(
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

        await pinTree.press('ui-base-virtual-field:virtual-pin')

        await expect(pinTree.getText('ui-base-virtual-keyboard:title')).resolves.toBe('PIN 键盘')
        await expect(pinTree.getNode('ui-base-virtual-keyboard:key:9')).resolves.toBeTruthy()
        await expect(pinTree.getNode('ui-base-virtual-keyboard:key:A')).resolves.toBeNull()

        const activationTree = renderWithAutomation(
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

        await activationTree.press('ui-base-virtual-field:virtual-activation-code')

        await expect(activationTree.getText('ui-base-virtual-keyboard:title')).resolves.toBe('激活码键盘')
        await expect(activationTree.getNode('ui-base-virtual-keyboard:key:A')).resolves.toBeTruthy()
        await expect(activationTree.getNode('ui-base-virtual-keyboard:key:Z')).resolves.toBeTruthy()
        await expect(activationTree.getNode('ui-base-virtual-keyboard:key:-')).resolves.toBeTruthy()
        await expect(activationTree.getNode('ui-base-virtual-keyboard:key:.')).resolves.toBeNull()
    })

    it('exposes json keyboard with braces and punctuation keys', async () => {
        const harness = await createInputHarness()
        const tree = renderWithAutomation(
            <InputRuntimeProvider>
                <>
                    <InputField
                        value=""
                        onChangeText={() => {}}
                        mode="virtual-json"
                    />
                    <VirtualKeyboardOverlay />
                </>
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        )

        await tree.press('ui-base-virtual-field:virtual-json')

        await expect(tree.getText('ui-base-virtual-keyboard:title')).resolves.toBe('JSON 键盘')
        await expect(tree.getNode('ui-base-virtual-keyboard:key:{')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:}')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key::')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:,')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:\"')).resolves.toBeTruthy()
    })

    it('closes the virtual keyboard when the owning virtual field unmounts', async () => {
        const harness = await createInputHarness()
        const tree = renderWithAutomation(
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

        await tree.press('ui-base-virtual-field:virtual-activation-code')
        await tree.waitForNode('ui-base-virtual-keyboard')

        await tree.update(
            <InputRuntimeProvider>
                <VirtualKeyboardOverlay />
            </InputRuntimeProvider>,
        )

        await expect(tree.queryNodes('ui-base-virtual-keyboard')).resolves.toHaveLength(0)
    })

    it('reduces the amount keyboard to four rows and removes clear or minus keys', async () => {
        const harness = await createInputHarness()
        const tree = renderWithAutomation(
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

        await tree.press('ui-base-virtual-field:virtual-amount')
        await tree.waitForNode('ui-base-virtual-keyboard')

        await expect(tree.getNode('ui-base-virtual-keyboard:key:0')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:.')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:backspace')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:clear')).resolves.toBeNull()
        await expect(tree.getNode('ui-base-virtual-keyboard:key:-')).resolves.toBeNull()
    })

    it('keeps unspecified fields on the system keyboard path', async () => {
        const harness = await createInputHarness()
        const automation = renderWithAutomation(
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

        await expect(automation.getNode('ui-base-system-field:system-text')).resolves.toMatchObject({
            testID: 'ui-base-system-field:system-text',
            role: 'input',
        })
    })
})
