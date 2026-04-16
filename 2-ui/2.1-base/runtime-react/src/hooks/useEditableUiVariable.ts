import {useCallback} from 'react'
import {useSelector} from 'react-redux'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions, selectUiVariable} from '@impos2/kernel-base-ui-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {useUiRuntime} from '../contexts'
import type {UiRuntimeVariable} from '../types'

export const useEditableUiVariable = <TValue = unknown>(
    variable: UiRuntimeVariable<TValue>,
) => {
    const runtime = useUiRuntime()
    const value = useSelector<RootState, TValue | undefined | null>((state) =>
        selectUiVariable<TValue>(state, variable.key, variable.defaultValue),
    )

    const setValue = useCallback(async (nextValue: TValue) => {
        await runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.setUiVariables, {
                [variable.key]: nextValue,
            }),
        )
    }, [runtime, variable.key])

    const clearValue = useCallback(async () => {
        await runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.clearUiVariables, [variable.key]),
        )
    }, [runtime, variable.key])

    return {
        value,
        setValue,
        clearValue,
    }
}
