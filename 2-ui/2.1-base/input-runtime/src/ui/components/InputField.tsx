import React, {useEffect, useMemo, useRef} from 'react'
import {Pressable, Text, TextInput, View} from 'react-native'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
} from '@impos2/ui-base-runtime-react'
import type {ManagedInputMode} from '../../types'
import {usesVirtualKeyboard} from '../../foundations/inputPolicies'
import {createInputRuntimeId} from '../../supports'
import {useOptionalInputRuntime} from '../../contexts'

export interface InputFieldProps {
    value: string
    onChangeText: (text: string) => void
    mode?: ManagedInputMode
    placeholder?: string
    secureTextEntry?: boolean
    maxLength?: number
    testID?: string
}

const mapModeToKeyboardType = (mode: ManagedInputMode): 'default' | 'numeric' => {
    if (mode === 'system-number') {
        return 'numeric'
    }
    return 'default'
}

export const InputField: React.FC<InputFieldProps> = ({
    value,
    onChangeText,
    mode = 'system-text',
    placeholder,
    secureTextEntry,
    maxLength,
    testID,
}) => {
    const runtime = useOptionalInputRuntime()
    const activateInput = runtime?.activateInput
    const deactivateInput = runtime?.deactivateInput
    const syncInputValue = runtime?.syncInputValue
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? 'runtime'
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const inputIdRef = useRef<string>(createInputRuntimeId('field'))
    const isVirtual = usesVirtualKeyboard(mode)
    const resolvedTestId = testID ?? (isVirtual ? `ui-base-virtual-field:${mode}` : `ui-base-system-field:${mode}`)

    useEffect(() => {
        if (!isVirtual || !syncInputValue) {
            return
        }
        syncInputValue(inputIdRef.current, value)
    }, [isVirtual, syncInputValue, value])

    useEffect(() => {
        if (!isVirtual || !deactivateInput) {
            return
        }
        return () => {
            deactivateInput(inputIdRef.current)
        }
    }, [deactivateInput, isVirtual])

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        return automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'input',
            mountId: `input:${inputIdRef.current}`,
            nodeId: resolvedTestId,
            testID: resolvedTestId,
            semanticId: resolvedTestId,
            role: isVirtual ? 'button' : 'input',
            text: value.length > 0 ? value : placeholder,
            value,
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: isVirtual ? ['press'] : ['changeText', 'clear'],
            onAutomationAction: action => {
                if (action.action === 'press' && isVirtual) {
                    activateInput?.({
                        id: inputIdRef.current,
                        mode,
                        value,
                        placeholder,
                        secureTextEntry,
                        maxLength,
                        onChangeText,
                    })
                    return {ok: true}
                }
                if (isVirtual) {
                    return {ok: false}
                }
                if (action.action === 'changeText') {
                    onChangeText(String(action.value ?? ''))
                    return {ok: true}
                }
                if (action.action === 'clear') {
                    onChangeText('')
                    return {ok: true}
                }
                return {ok: false}
            },
        })
    }, [
        activateInput,
        automationBridge,
        automationRuntimeId,
        automationTarget,
        isVirtual,
        maxLength,
        mode,
        onChangeText,
        placeholder,
        resolvedTestId,
        secureTextEntry,
        value,
    ])

    const maskedValue = useMemo(() => {
        if (!secureTextEntry) {
            return value
        }
        return '•'.repeat(value.length)
    }, [secureTextEntry, value])

    if (isVirtual) {
        return (
            <Pressable
                testID={resolvedTestId}
                accessibilityRole="button"
                onPress={() => activateInput?.({
                    id: inputIdRef.current,
                    mode,
                    value,
                    placeholder,
                    secureTextEntry,
                    maxLength,
                    onChangeText,
                })}
            >
                <View
                    style={{
                        minHeight: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#cfd8e3',
                        backgroundColor: '#ffffff',
                        paddingHorizontal: 14,
                        justifyContent: 'center',
                    }}
                >
                    <Text style={{color: value.length > 0 ? '#0f172a' : '#94a3b8'}}>
                        {value.length > 0 ? maskedValue : (placeholder ?? '')}
                    </Text>
                </View>
            </Pressable>
        )
    }

    return (
        <TextInput
            testID={resolvedTestId}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            secureTextEntry={secureTextEntry}
            keyboardType={mapModeToKeyboardType(mode)}
            maxLength={maxLength}
            style={{
                minHeight: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#cfd8e3',
                backgroundColor: '#ffffff',
                paddingHorizontal: 14,
                color: '#0f172a',
            }}
        />
    )
}
