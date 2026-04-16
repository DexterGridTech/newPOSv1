import type {ComponentType} from 'react'
import type {UiScreenDefinition} from '@impos2/kernel-base-ui-runtime-v2'
import {defineUiScreenPart} from './defineUiScreenPart'

export const defaultUiModalContainerKey = 'overlay.modal'

export interface DefineUiModalPartInput<TProps = unknown>
    extends Omit<UiScreenDefinition<TProps>, 'readyToEnter' | 'containerKey'> {
    component: ComponentType<TProps>
    containerKey?: string
}

export const defineUiModalPart = <TProps = unknown>(
    input: DefineUiModalPartInput<TProps>,
) => defineUiScreenPart({
    ...input,
    kind: 'modal',
    containerKey: input.containerKey ?? defaultUiModalContainerKey,
})
