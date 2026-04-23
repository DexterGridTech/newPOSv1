import type {AutomationTrace} from './automationTrace'
import type {AutomationEvent} from '../types/events'
import type {AutomationTarget} from '../types/protocol'

export interface WaitResult {
    readonly ok: boolean
    readonly blocker?: string
}

export const createWaitEngine = (input: {
    readonly trace: AutomationTrace
    readonly getPendingRequestCount: (target: Exclude<AutomationTarget, 'all' | 'host'>) => number
    readonly getInFlightActionCount: (target: Exclude<AutomationTarget, 'all' | 'host'>) => number
    readonly getInFlightScriptCount: (target: Exclude<AutomationTarget, 'all' | 'host'>) => number
    readonly subscribeToRuntimeEvents: (
        target: Exclude<AutomationTarget, 'all' | 'host'>,
        handler: (event: AutomationEvent) => void,
    ) => () => void
    readonly quietWindowMs?: number
}) => ({
    async forIdle(options: {
        readonly target: Exclude<AutomationTarget, 'all' | 'host'>
        readonly timeoutMs: number
    }): Promise<WaitResult> {
        const quietWindowMs = input.quietWindowMs ?? 300
        const startedAt = Date.now()
        let lastActivityAt = startedAt
        let lastBlocker = 'unknown'

        const unsubscribe = input.subscribeToRuntimeEvents(options.target, event => {
            if (
                event.topic === 'runtime.stateChanged'
                || event.topic === 'runtime.screenChanged'
                || event.topic === 'runtime.requestChanged'
            ) {
                lastActivityAt = Date.now()
            }
        })

        try {
            while (Date.now() - startedAt < options.timeoutMs) {
                const pendingRequests = input.getPendingRequestCount(options.target)
                const inFlightActions = input.getInFlightActionCount(options.target)
                const inFlightScripts = input.getInFlightScriptCount(options.target)

                if (pendingRequests === 0 && inFlightActions === 0 && inFlightScripts === 0) {
                    if (Date.now() - lastActivityAt >= quietWindowMs) {
                        const result = {ok: true}
                        input.trace.record({
                            step: 'wait.forIdle',
                            status: 'ok',
                            input: options,
                            output: result,
                        })
                        return result
                    }
                    lastBlocker = 'quiet-window'
                } else if (pendingRequests > 0) {
                    lastBlocker = `pending-requests:${pendingRequests}`
                } else if (inFlightActions > 0) {
                    lastBlocker = `in-flight-actions:${inFlightActions}`
                } else {
                    lastBlocker = `in-flight-scripts:${inFlightScripts}`
                }

                await new Promise(resolve => setTimeout(resolve, 25))
            }

            const result = {ok: false, blocker: lastBlocker}
            input.trace.record({
                step: 'wait.forIdle',
                status: 'failed',
                input: options,
                output: result,
                error: `WAIT_FOR_IDLE_TIMEOUT:${lastBlocker}`,
            })
            return result
        } finally {
            unsubscribe()
        }
    },
})
