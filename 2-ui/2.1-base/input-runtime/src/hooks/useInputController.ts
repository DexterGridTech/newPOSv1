import {useMemo, useState} from 'react'
import type {
    InputControllerState,
    ManagedInputMode,
    InputPersistencePolicy,
    VirtualKeyboardKey,
} from '../types'
import {createInputController} from '../supports/inputController'

export interface UseInputControllerInput {
    initialValue?: string
    mode: ManagedInputMode
    persistence?: InputPersistencePolicy
    maxLength?: number
}

export const useInputController = (
    input: UseInputControllerInput,
) => {
    const [state, setState] = useState<InputControllerState>({
        value: input.initialValue ?? '',
        mode: input.mode,
        persistence: input.persistence ?? 'transient',
        maxLength: input.maxLength,
    })

    const controller = useMemo(() => createInputController(state), [])

    return {
        state,
        setValue(value: string) {
            controller.setValue(value)
            setState(controller.getState())
        },
        applyVirtualKey(key: VirtualKeyboardKey) {
            controller.applyVirtualKey(key)
            setState(controller.getState())
        },
        clear() {
            controller.clear()
            setState(controller.getState())
        },
    }
}
