import type {CommandIntent} from '@impos2/kernel-base-runtime-shell-v2'

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

export interface UiAlertInfo {
    title?: string
    message?: string
    level?: 'info' | 'warning' | 'error' | 'success'
    confirmText?: string
    cancelText?: string
    confirmAction?: UiAlertAction
    cancelAction?: UiAlertAction
    metadata?: Record<string, unknown>
}

export interface UiAlertAction {
    commands?: readonly CommandIntent[]
    metadata?: Record<string, unknown>
}
