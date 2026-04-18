import type {AutomationTarget} from './protocol'
import type {AutomationNodeAction} from './selectors'

export interface PerformNodeActionInput {
    readonly target: Exclude<AutomationTarget, 'all' | 'host'>
    readonly nodeId: string
    readonly action: AutomationNodeAction
    readonly value?: unknown
}

export interface AutomationActionResult {
    readonly ok: boolean
    readonly nodeId?: string
    readonly message?: string
}
