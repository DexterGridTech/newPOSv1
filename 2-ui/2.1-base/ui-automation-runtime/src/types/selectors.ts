import type {AutomationTarget} from './protocol'

export type AutomationNodeAction =
    | 'press'
    | 'longPress'
    | 'changeText'
    | 'clear'
    | 'submit'
    | 'focus'
    | 'blur'
    | 'scroll'

export interface AutomationNodeBounds {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

export interface AutomationNodeSnapshot {
    readonly target: Exclude<AutomationTarget, 'all' | 'host'>
    readonly runtimeId: string
    readonly screenKey: string
    readonly mountId: string
    readonly nodeId: string
    readonly testID?: string
    readonly semanticId?: string
    readonly role?: string
    readonly text?: string
    readonly value?: unknown
    readonly visible: boolean
    readonly enabled: boolean
    readonly focused?: boolean
    readonly bounds?: AutomationNodeBounds
    readonly availableActions: readonly AutomationNodeAction[]
    readonly persistent?: boolean
    readonly stale?: boolean
}

export interface AutomationNodeQuery {
    readonly target: Exclude<AutomationTarget, 'all' | 'host'>
    readonly testID?: string
    readonly semanticId?: string
    readonly text?: string
    readonly role?: string
    readonly screen?: string
    readonly path?: string
}
