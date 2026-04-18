import type {ComponentType} from 'react'

export interface ResolvedUiScreenPart<TProps = unknown> {
    partKey: string
    rendererKey: string
    Component: ComponentType<TProps>
    props?: TProps
}

export interface MissingUiRendererPart {
    partKey: string
    rendererKey: string
    name: string
    title: string
    description: string
    props?: unknown
}

export type UiChildScreenPartResolution<TProps = unknown> =
    | {
        status: 'empty'
        containerKey: string
      }
    | {
        status: 'missing-renderer'
        containerKey: string
        missing: MissingUiRendererPart
      }
    | {
        status: 'ready'
        containerKey: string
        child: ResolvedUiScreenPart<TProps>
      }
