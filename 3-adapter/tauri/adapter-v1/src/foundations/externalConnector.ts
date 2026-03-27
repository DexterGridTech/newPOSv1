import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
    ExternalConnector,
    ChannelType,
    ChannelDescriptor,
    ConnectorEvent,
    ConnectorResponse,
} from '@impos2/kernel-core-base'

// channelId → unlisten 函数，用于 unsubscribe 时清理
const streamUnsubs = new Map<string, () => void>()

export const externalConnectorAdapter: ExternalConnector = {
    call<T = any>(
        channel: ChannelDescriptor,
        action: string,
        params?: Record<string, any>,
        timeout?: number,
    ): Promise<ConnectorResponse<T>> {
        return invoke<ConnectorResponse<T>>('connector_call', {
            channelJson: JSON.stringify(channel),
            action,
            paramsJson: JSON.stringify(params ?? {}),
            timeout: timeout ?? 30000,
        })
    },

    async subscribe(
        channel: ChannelDescriptor,
        onEvent: (event: ConnectorEvent) => void,
        onError?: (error: ConnectorEvent) => void,
    ): Promise<string> {
        const channelId = await invoke<string>('connector_subscribe', {
            channelJson: JSON.stringify(channel),
        })

        const unlisten = await listen<ConnectorEvent>(`connector://stream/${channelId}`, (event) => {
            const payload = event.payload
            if (payload.data == null) {
                onError?.(payload)
            } else {
                onEvent(payload)
            }
        })

        streamUnsubs.set(channelId, unlisten)
        return channelId
    },

    async unsubscribe(channelId: string): Promise<void> {
        streamUnsubs.get(channelId)?.()
        streamUnsubs.delete(channelId)
        await invoke('connector_unsubscribe', { channelId })
    },

    on(eventType: string, handler: (event: ConnectorEvent) => void): () => void {
        let unlisten: (() => void) | null = null
        listen<ConnectorEvent>(eventType, (event) => handler(event.payload)).then((fn) => {
            unlisten = fn
        })
        return () => unlisten?.()
    },

    isAvailable(channel: ChannelDescriptor): Promise<boolean> {
        return invoke<boolean>('connector_is_available', { channelJson: JSON.stringify(channel) })
    },

    getAvailableTargets(type: ChannelType): Promise<string[]> {
        return invoke<string[]>('connector_get_available_targets', { channelType: type })
    },
}

export function cleanupExternalConnector(): void {
    streamUnsubs.forEach((unsub) => unsub())
    streamUnsubs.clear()
}
