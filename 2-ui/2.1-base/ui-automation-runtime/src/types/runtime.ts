import type {AutomationTarget} from './protocol'

export interface SessionHelloResult {
    readonly protocolVersion: number
    readonly capabilities: readonly string[]
    readonly availableTargets: readonly AutomationTarget[]
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly productMode: boolean
    readonly scriptExecutionAvailable: boolean
}
