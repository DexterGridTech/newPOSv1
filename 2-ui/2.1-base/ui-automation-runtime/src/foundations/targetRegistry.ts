import type {AutomationTarget} from '../types/protocol'

export interface AutomationTargetRegistration {
    readonly target: Exclude<AutomationTarget, 'all'>
    readonly runtimeId: string
}

export interface AutomationTargetSnapshot {
    readonly target: Exclude<AutomationTarget, 'all'>
    readonly runtimeId: string
}

export interface AutomationTargetRegistry {
    register(input: AutomationTargetRegistration): () => void
    list(): readonly AutomationTargetSnapshot[]
    has(target: Exclude<AutomationTarget, 'all'>): boolean
    clearTarget(target: Exclude<AutomationTarget, 'all'>): void
}

export const createAutomationTargetRegistry = (): AutomationTargetRegistry => {
    const targets = new Map<Exclude<AutomationTarget, 'all'>, AutomationTargetSnapshot>()
    targets.set('host', {target: 'host', runtimeId: 'host'})

    return {
        register(input) {
            targets.set(input.target, {
                target: input.target,
                runtimeId: input.runtimeId,
            })
            return () => {
                const current = targets.get(input.target)
                if (current?.runtimeId === input.runtimeId) {
                    if (input.target !== 'host') {
                        targets.delete(input.target)
                    }
                }
            }
        },
        list() {
            const order: readonly Exclude<AutomationTarget, 'all'>[] = ['host', 'primary', 'secondary']
            return order.flatMap(target => {
                const snapshot = targets.get(target)
                return snapshot ? [snapshot] : []
            })
        },
        has(target) {
            return targets.has(target)
        },
        clearTarget(target) {
            if (target !== 'host') {
                targets.delete(target)
            }
        },
    }
}
