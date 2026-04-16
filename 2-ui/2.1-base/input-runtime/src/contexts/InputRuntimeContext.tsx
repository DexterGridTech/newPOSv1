import React, {createContext, useCallback, useContext, useMemo, useState} from 'react'
import type {ManagedInputMode, VirtualKeyboardKey} from '../types'
import {applyVirtualKeyToValue} from '../supports/inputController'

export interface ActiveVirtualInput {
    id: string
    mode: ManagedInputMode
    value: string
    placeholder?: string
    secureTextEntry?: boolean
    maxLength?: number
    onChangeText: (value: string) => void
}

export interface ActivateVirtualInputPayload extends Omit<ActiveVirtualInput, 'value'> {
    value?: string
}

export interface InputRuntimeContextValue {
    activeInput: ActiveVirtualInput | null
    activateInput(input: ActivateVirtualInputPayload): void
    deactivateInput(inputId?: string): void
    syncInputValue(inputId: string, value: string): void
    applyVirtualKey(key: VirtualKeyboardKey): void
}

const InputRuntimeContext = createContext<InputRuntimeContextValue | null>(null)

export interface InputRuntimeProviderProps {
    children: React.ReactNode
}

export const InputRuntimeProvider: React.FC<InputRuntimeProviderProps> = ({children}) => {
    const [activeInput, setActiveInput] = useState<ActiveVirtualInput | null>(null)

    const activateInput = useCallback((input: ActivateVirtualInputPayload) => {
        setActiveInput({
            ...input,
            value: input.value ?? '',
        })
    }, [])

    const deactivateInput = useCallback((inputId?: string) => {
        setActiveInput(current => {
            if (!current) {
                return null
            }
            if (inputId && current.id !== inputId) {
                return current
            }
            return null
        })
    }, [])

    const syncInputValue = useCallback((inputId: string, value: string) => {
        setActiveInput(current => {
            if (!current || current.id !== inputId || current.value === value) {
                return current
            }
            return {
                ...current,
                value,
            }
        })
    }, [])

    const applyVirtualKey = useCallback((key: VirtualKeyboardKey) => {
        setActiveInput(current => {
            if (!current) {
                return current
            }
            if (key === 'close') {
                return null
            }

            const nextValue = applyVirtualKeyToValue(current.value, key, current.mode, current.maxLength)
            if (nextValue !== current.value) {
                current.onChangeText(nextValue)
            }

            return key === 'enter'
                ? null
                : {
                    ...current,
                    value: nextValue,
                }
        })
    }, [])

    const value = useMemo<InputRuntimeContextValue>(() => ({
        activeInput,
        activateInput,
        deactivateInput,
        syncInputValue,
        applyVirtualKey,
    }), [activeInput, activateInput, applyVirtualKey, deactivateInput, syncInputValue])

    return (
        <InputRuntimeContext.Provider value={value}>
            {children}
        </InputRuntimeContext.Provider>
    )
}

export const useOptionalInputRuntime = (): InputRuntimeContextValue | null =>
    useContext(InputRuntimeContext)

export const useInputRuntime = (): InputRuntimeContextValue => {
    const context = useOptionalInputRuntime()
    if (!context) {
        throw new Error('[ui-base-input-runtime] missing InputRuntimeProvider')
    }
    return context
}
