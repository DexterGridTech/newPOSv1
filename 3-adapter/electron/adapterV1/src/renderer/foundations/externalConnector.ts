import type {ChannelDescriptor, ChannelType, ConnectorEvent, ConnectorResponse, ExternalConnector} from '@impos2/kernel-core-base';
import {getHostBridge} from './hostBridge';

const passiveHandlerMap = new WeakMap<(event: ConnectorEvent) => void, () => void>();
const streamChannelMap = new Map<string, () => void>();

export const externalConnectorAdapter: ExternalConnector = {
  call<T = any>(
    channel: ChannelDescriptor,
    action: string,
    params?: Record<string, any>,
    timeout?: number,
  ): Promise<ConnectorResponse<T>> {
    return getHostBridge().externalConnector.call<T>(channel, action, params, timeout);
  },
  async subscribe(
    channel: ChannelDescriptor,
    onEvent: (event: ConnectorEvent) => void,
    onError?: (error: ConnectorEvent) => void,
  ): Promise<string> {
    const channelId = await getHostBridge().externalConnector.subscribe(channel);
    const cleanup = getHostBridge().events.on('externalConnector.stream', payload => {
      if (payload.channelId !== channelId) {
        return;
      }
      if (payload.event.data == null) {
        onError?.(payload.event);
        return;
      }
      onEvent(payload.event);
    });
    streamChannelMap.set(channelId, cleanup);
    return channelId;
  },
  async unsubscribe(channelId: string): Promise<void> {
    streamChannelMap.get(channelId)?.();
    streamChannelMap.delete(channelId);
    await getHostBridge().externalConnector.unsubscribe(channelId);
  },
  on(eventType: string, handler: (event: ConnectorEvent) => void): () => void {
    const cleanup = getHostBridge().events.on('externalConnector.passive', payload => {
      if (payload.eventType !== eventType) {
        return;
      }
      handler(payload.event);
    });
    passiveHandlerMap.set(handler, cleanup);
    return () => {
      passiveHandlerMap.get(handler)?.();
      passiveHandlerMap.delete(handler);
    };
  },
  isAvailable(channel: ChannelDescriptor): Promise<boolean> {
    return getHostBridge().externalConnector.isAvailable(channel);
  },
  getAvailableTargets(type: ChannelType): Promise<string[]> {
    return getHostBridge().externalConnector.getAvailableTargets(type);
  },
};
