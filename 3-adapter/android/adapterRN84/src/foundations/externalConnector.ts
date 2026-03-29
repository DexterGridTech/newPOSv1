import {
    ExternalConnector,
    ChannelType,
    ChannelDescriptor,
    ConnectorEvent,
    ConnectorResponse,
} from '@impos2/kernel-core-base'

// Stub: ConnectorTurboModule 尚未实现
export const externalConnectorAdapter: ExternalConnector = {
    call<T = any>(
        _channel: ChannelDescriptor,
        _action: string,
        _params?: Record<string, any>,
        _timeout?: number,
    ): Promise<ConnectorResponse<T>> {
        return Promise.resolve({success: false, data: null as any, error: 'stub'})
    },

    subscribe(
        _channel: ChannelDescriptor,
        _onEvent: (event: ConnectorEvent) => void,
        _onError?: (error: ConnectorEvent) => void,
    ): Promise<string> {
        return Promise.resolve('stub-channel-id')
    },

    unsubscribe(_channelId: string): Promise<void> {
        return Promise.resolve()
    },

    on(_eventType: string, _handler: (event: ConnectorEvent) => void): () => void {
        return () => {}
    },

    isAvailable(_channel: ChannelDescriptor): Promise<boolean> {
        return Promise.resolve(false)
    },

    getAvailableTargets(_type: ChannelType): Promise<string[]> {
        return Promise.resolve([])
    },
}

export function cleanupExternalConnector(): void {}
