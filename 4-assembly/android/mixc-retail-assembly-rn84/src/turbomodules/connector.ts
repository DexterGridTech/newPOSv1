import {NativeEventEmitter} from 'react-native'
import NativeConnectorTurboModule from './specs/NativeConnectorTurboModule'

const emitter = new NativeEventEmitter(NativeConnectorTurboModule as any)
const subscriptions = new Map<string, {remove: () => void}>()

export const nativeConnector = {
    async call(input: {
        channel: Record<string, unknown>
        action: string
        params?: Record<string, unknown>
        timeoutMs?: number
    }): Promise<Record<string, unknown>> {
        return await NativeConnectorTurboModule.call(
            JSON.stringify(input.channel),
            input.action,
            JSON.stringify(input.params ?? {}),
            input.timeoutMs ?? 30_000,
        )
    },
    async subscribe(input: {
        channel: Record<string, unknown>
        onMessage: (message: Record<string, unknown>) => void
        onError?: (error: Record<string, unknown>) => void
    }): Promise<string> {
        const subscriptionId = await NativeConnectorTurboModule.subscribe(JSON.stringify(input.channel))
        const listener = emitter.addListener('connector.stream', (event: Record<string, unknown>) => {
            if (event.channelId !== subscriptionId) {
                return
            }
            if (event.data == null) {
                input.onError?.(event)
                return
            }
            input.onMessage(event)
        })
        subscriptions.set(subscriptionId, listener)
        return subscriptionId
    },
    async unsubscribe(subscriptionId: string): Promise<void> {
        subscriptions.get(subscriptionId)?.remove()
        subscriptions.delete(subscriptionId)
        await NativeConnectorTurboModule.unsubscribe(subscriptionId)
    },
    on(eventType: string, handler: (event: Record<string, unknown>) => void): () => void {
        const listener = emitter.addListener(eventType, handler)
        return () => listener.remove()
    },
    async isAvailable(channel: Record<string, unknown>): Promise<boolean> {
        return await NativeConnectorTurboModule.isAvailable(JSON.stringify(channel))
    },
    async getAvailableTargets(type: string): Promise<readonly string[]> {
        return await NativeConnectorTurboModule.getAvailableTargets(type)
    },
}
