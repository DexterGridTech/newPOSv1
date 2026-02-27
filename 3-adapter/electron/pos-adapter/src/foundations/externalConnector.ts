import {
    ExternalConnector,
    ChannelType,
    ChannelDescriptor,
    ConnectorEvent,
    ConnectorResponse,
} from '@impos2/kernel-core-base'

const streamUnsubs = new Map<string, () => void>()

export const externalConnectorAdapter: ExternalConnector = {
    call<T = any>(
        channel: ChannelDescriptor,
        action: string,
        params?: Record<string, any>,
        timeout?: number,
    ): Promise<ConnectorResponse<T>> {
        return window.electronBridge.invoke('connector:call', {
            channel: JSON.stringify(channel),
            action,
            params: JSON.stringify(params ?? {}),
            timeout: timeout ?? 30000,
        })
    },

    async subscribe(
        channel: ChannelDescriptor,
        onEvent: (event: ConnectorEvent) => void,
        onError?: (error: ConnectorEvent) => void,
    ): Promise<string> {
        const channelId: string = await window.electronBridge.invoke('connector:subscribe', JSON.stringify(channel))
        const unsub = window.electronBridge.on(`connector:stream:${channelId}`, (event: ConnectorEvent) => {
            if (event.data == null) { onError?.(event) } else { onEvent(event) }
        })
        streamUnsubs.set(channelId, unsub)
        return channelId
    },

    unsubscribe(channelId: string): Promise<void> {
        streamUnsubs.get(channelId)?.()
        streamUnsubs.delete(channelId)
        return window.electronBridge.invoke('connector:unsubscribe', channelId)
    },

    on(eventType: string, handler: (event: ConnectorEvent) => void): () => void {
        return window.electronBridge.on(eventType, handler)
    },

    isAvailable(channel: ChannelDescriptor): Promise<boolean> {
        return window.electronBridge.invoke('connector:isAvailable', JSON.stringify(channel))
    },

    getAvailableTargets(type: ChannelType): Promise<string[]> {
        return window.electronBridge.invoke('connector:getAvailableTargets', type)
    },
}

export function cleanupExternalConnector(): void {
    streamUnsubs.forEach(unsub => unsub())
    streamUnsubs.clear()
}
