import type {ComponentType} from 'react'
import type {
    UiAlertInfo,
    UiScreenDefinition,
} from '@next/kernel-base-ui-runtime-v2'
import {defineUiScreenPart} from './defineUiScreenPart'

export const defaultUiAlertContainerKey = 'overlay.alert'

export interface DefineUiAlertPartInput<TProps = UiAlertInfo>
    extends Omit<UiScreenDefinition<TProps>, 'readyToEnter' | 'containerKey'> {
    component: ComponentType<TProps>
    containerKey?: string
}

export const defineUiAlertPart = <TProps = UiAlertInfo>(
    input: DefineUiAlertPartInput<TProps>,
) => defineUiScreenPart({
    ...input,
    kind: 'alert',
    containerKey: input.containerKey ?? defaultUiAlertContainerKey,
})
