import type {
    InputController,
    InputControllerState,
    ManagedInputMode,
    VirtualKeyboardKey,
} from '../types'

const normalizeAmountValue = (
    value: string,
    key: string,
): string => {
    const candidate = (() => {
        if (key === '.') {
            return value.includes('.') ? value : `${value || '0'}.`
        }
        if (key === '-') {
            return value.startsWith('-') ? value.slice(1) : `-${value}`
        }
        return `${value}${key}`
    })()

    return /^-?\d*\.?\d*$/.test(candidate) ? candidate : value
}

const normalizeActivationCodeValue = (
    value: string,
    key: string,
): string => `${value}${key.toUpperCase()}`

const normalizeIdentifierValue = (
    value: string,
    key: string,
): string => `${value}${key.toUpperCase()}`

export const applyVirtualKeyToValue = (
    value: string,
    key: VirtualKeyboardKey,
    mode?: ManagedInputMode,
    maxLength?: number,
): string => {
    if (key === 'backspace') {
        return value.slice(0, -1)
    }
    if (key === 'clear') {
        return ''
    }
    if (key === 'enter' || key === 'close') {
        return value
    }

    const nextValue = (() => {
        if (mode === 'virtual-amount') {
            return normalizeAmountValue(value, key)
        }
        if (mode === 'virtual-activation-code') {
            return normalizeActivationCodeValue(value, key)
        }
        if (mode === 'virtual-identifier') {
            return normalizeIdentifierValue(value, key)
        }
        return `${value}${key}`
    })()

    if (typeof maxLength === 'number' && maxLength > 0) {
        return nextValue.slice(0, maxLength)
    }
    return nextValue
}

export const createInputController = (
    initialState: InputControllerState,
): InputController => {
    let state = initialState

    return {
        getState() {
            return state
        },
        setValue(value) {
            state = {
                ...state,
                value,
            }
        },
        applyVirtualKey(key) {
            state = {
                ...state,
                value: applyVirtualKeyToValue(state.value, key, state.mode, state.maxLength),
            }
        },
        clear() {
            state = {
                ...state,
                value: '',
            }
        },
    }
}
