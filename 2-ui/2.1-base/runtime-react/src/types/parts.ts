import type {ComponentType} from 'react'
import type {
    UiAlertInfo,
    UiScreenDefinition,
} from '@impos2/kernel-base-ui-runtime-v2'

export type UiPartKind = 'screen' | 'modal' | 'alert'

export interface UiScreenPartDefinition<TProps = unknown> {
    kind: UiPartKind
    definition: UiScreenDefinition<TProps>
    component: ComponentType<TProps>
}

export type UiModalPartDefinition<TProps = unknown> = UiScreenPartDefinition<TProps>

export type UiAlertPartDefinition<TProps = UiAlertInfo> = UiScreenPartDefinition<TProps>

export interface UiRuntimeVariable<TValue = unknown> {
    key: string
    defaultValue?: TValue
    persistence?: 'transient' | 'recoverable' | 'secure-never-persist'
}
