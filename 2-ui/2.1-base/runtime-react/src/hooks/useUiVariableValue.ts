import {useSelector} from 'react-redux'
import {selectUiVariable} from '@impos2/kernel-base-ui-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {UiRuntimeVariable} from '../types'

export const useUiVariableValue = <TValue = unknown>(
    variable: UiRuntimeVariable<TValue>,
): TValue | undefined | null =>
    useSelector<RootState, TValue | undefined | null>((state) =>
        selectUiVariable<TValue>(state, variable.key, variable.defaultValue),
    )
