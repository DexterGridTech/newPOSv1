export interface UiScreenDefinition<TProps = unknown> {
    partKey: string
    rendererKey: string
    name: string
    title: string
    description: string
    containerKey?: string
    indexInContainer?: number | null
    screenModes: readonly string[]
    workspaces: readonly string[]
    instanceModes: readonly string[]
    readyToEnter?: () => boolean
    metadata?: Record<string, unknown>
}

export interface UiScreenRuntimeEntry<TProps = unknown> {
    partKey: string
    rendererKey: string
    name: string
    title: string
    description: string
    containerKey: string
    id?: string | null
    props?: TProps
    source?: string
    operation: 'show' | 'replace'
}

export interface UiOverlayEntry<TProps = unknown> {
    id: string
    screenPartKey: string
    rendererKey: string
    props?: TProps
    openedAt: number
}

export interface UiScreenRegistryContext {
    screenMode: string
    workspace: string
    instanceMode: string
}
