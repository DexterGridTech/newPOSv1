import type {AutomationTarget} from './protocol'

export type AutomationEventTopic =
    | 'runtime.ready'
    | 'runtime.disposed'
    | 'runtime.screenChanged'
    | 'runtime.stateChanged'
    | 'runtime.requestChanged'
    | 'automation.completed'
    | 'host.connectionChanged'
    | 'registry.nodeMounted'
    | 'registry.nodeUnmounted'

export interface AutomationEvent {
    readonly topic: AutomationEventTopic
    readonly target: Exclude<AutomationTarget, 'all'>
    readonly payload: unknown
    readonly createdAt: number
}
