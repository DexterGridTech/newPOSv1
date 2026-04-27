import type {ComponentType} from 'react'

export interface ResolvedUiScreenPart<TProps = unknown> {
    partKey: string
    rendererKey: string
    id?: string | null
    source?: string
    operation?: 'show' | 'replace'
    Component: ComponentType<TProps>
    props?: TProps
}

export interface MissingUiRendererPart {
    partKey: string
    rendererKey: string
    id?: string | null
    source?: string
    operation?: 'show' | 'replace'
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
