import {useCallback, useEffect, useRef, useState} from 'react'
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

const toControlledState = (
    input: UseInputControllerInput,
): Omit<InputControllerState, 'value'> => ({
    mode: input.mode,
    persistence: input.persistence ?? 'transient',
    maxLength: input.maxLength,
})

export const useInputController = (
    input: UseInputControllerInput,
) => {
    const controlledStateRef = useRef(toControlledState(input))
    const [state, setState] = useState<InputControllerState>(() => ({
        value: input.initialValue ?? '',
        ...controlledStateRef.current,
    }))
    const controllerRef = useRef(createInputController({
        value: input.initialValue ?? '',
        ...controlledStateRef.current,
    }))

    const commitState = useCallback((nextState: InputControllerState) => {
        controllerRef.current = createInputController(nextState)
        setState(nextState)
    }, [])

    useEffect(() => {
        const nextControlledState = toControlledState(input)
        controlledStateRef.current = nextControlledState

        const current = controllerRef.current.getState()
        if (
            current.mode === nextControlledState.mode &&
            current.persistence === nextControlledState.persistence &&
            current.maxLength === nextControlledState.maxLength
        ) {
            return
        }

        commitState({
            ...current,
            ...nextControlledState,
        })
    }, [commitState, input.maxLength, input.mode, input.persistence])

    const setValue = useCallback((value: string) => {
        const controller = controllerRef.current
        controller.setValue(value)
        commitState({
            ...controller.getState(),
            ...controlledStateRef.current,
        })
    }, [commitState])

    const applyVirtualKey = useCallback((key: VirtualKeyboardKey) => {
        const controller = createInputController({
            ...controllerRef.current.getState(),
            ...controlledStateRef.current,
        })
        controller.applyVirtualKey(key)
        commitState({
            ...controller.getState(),
            ...controlledStateRef.current,
        })
    }, [commitState])

    const clear = useCallback(() => {
        const controller = controllerRef.current
        controller.clear()
        commitState({
            ...controller.getState(),
            ...controlledStateRef.current,
        })
    }, [commitState])

    return {
        state,
        setValue,
        applyVirtualKey,
        clear,
    }
}
