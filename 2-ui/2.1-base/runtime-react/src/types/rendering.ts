import type {ComponentType} from 'react'

export interface ResolvedUiScreenPart<TProps = unknown> {
    partKey: string
    rendererKey: string
    Component: ComponentType<TProps>
    props?: TProps
}
