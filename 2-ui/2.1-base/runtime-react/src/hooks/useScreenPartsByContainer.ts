import {shallowEqual, useSelector} from 'react-redux'
import {
    selectUiScreenDefinitionsByContainer,
    type UiScreenDefinition,
} from '@impos2/kernel-base-ui-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {UiRuntimeVariable} from '../types'

const resolveContainerKey = (input: string | UiRuntimeVariable) =>
    typeof input === 'string' ? input : input.key

export const useScreenPartsByContainer = (
    container: string | UiRuntimeVariable,
): readonly UiScreenDefinition[] => {
    const containerKey = resolveContainerKey(container)
    return useSelector<RootState, readonly UiScreenDefinition[]>(
        (state) => selectUiScreenDefinitionsByContainer(state, containerKey),
        shallowEqual,
    )
}
