import type {ComponentType} from 'react'
import type {UiScreenDefinition} from '@next/kernel-base-ui-runtime-v2'
import type {UiPartKind, UiScreenPartDefinition} from '../types'

export interface DefineUiScreenPartInput<TProps = unknown>
    extends Omit<UiScreenDefinition<TProps>, 'readyToEnter'> {
    component: ComponentType<TProps>
    kind?: UiPartKind
}

export const defineUiScreenPart = <TProps = unknown>(
    input: DefineUiScreenPartInput<TProps>,
): UiScreenPartDefinition<TProps> => {
    const {component, kind = 'screen', ...definition} = input

    return {
        kind,
        definition,
        component,
    }
}
