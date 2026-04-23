import type {AutomationEvent, AutomationEventTopic} from '../types/events'
import type {AutomationTarget} from '../types/protocol'

export interface AutomationSubscription {
    readonly id: string
    readonly target?: Exclude<AutomationTarget, 'all'>
    readonly topic?: AutomationEventTopic
    readonly sessionId?: string
}

export const createAutomationEventBus = () => {
    const subscriptions = new Map<string, {
        subscription: AutomationSubscription
        handler: (event: AutomationEvent) => void
    }>()

    return {
        subscribe(
            subscription: Omit<AutomationSubscription, 'id'>,
            handler: (event: AutomationEvent) => void,
        ): string {
            const id = `sub-${subscriptions.size + 1}`
            subscriptions.set(id, {
                subscription: {id, ...subscription},
                handler,
            })
            return id
        },
        unsubscribe(id: string): boolean {
            return subscriptions.delete(id)
        },
        clearSession(sessionId: string): void {
            for (const [id, entry] of subscriptions.entries()) {
                if (entry.subscription.sessionId === sessionId) {
                    subscriptions.delete(id)
                }
            }
        },
        clear(): void {
            subscriptions.clear()
        },
        list(): readonly AutomationSubscription[] {
            return [...subscriptions.values()].map(entry => entry.subscription)
        },
        publish(event: AutomationEvent): number {
            let delivered = 0
            for (const {subscription, handler} of subscriptions.values()) {
                if (subscription.target && subscription.target !== event.target) continue
                if (subscription.topic && subscription.topic !== event.topic) continue
                handler(event)
                delivered += 1
            }
            return delivered
        },
    }
}
