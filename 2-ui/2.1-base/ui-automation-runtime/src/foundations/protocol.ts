import type {AutomationMethod, AutomationTarget} from '../types/protocol'

export const AUTOMATION_PROTOCOL_VERSION = 1 as const

const sideEffectMethods = new Set<AutomationMethod>([
    'command.dispatch',
    'scripts.execute',
    'ui.performAction',
    'ui.revealNode',
    'ui.scroll',
    'ui.setValue',
    'ui.clearValue',
    'ui.submit',
])

const waitMethods = new Set<AutomationMethod>([
    'wait.forNode',
    'wait.forScreen',
    'wait.forState',
    'wait.forRequest',
    'wait.forIdle',
])

export const isSideEffectMethod = (method: AutomationMethod): boolean =>
    sideEffectMethods.has(method)

export const assertWaitTarget = (
    target: AutomationTarget,
): Exclude<AutomationTarget, 'all'> => {
    if (target === 'all') {
        throw new Error('wait target does not allow all')
    }
    return target
}

export const assertValidTarget = (
    method: AutomationMethod,
    target: AutomationTarget,
): AutomationTarget => {
    if (waitMethods.has(method)) {
        return assertWaitTarget(target)
    }
    if (target === 'all' && isSideEffectMethod(method)) {
        throw new Error(`all target is not allowed for side-effect method ${method}`)
    }
    return target
}
