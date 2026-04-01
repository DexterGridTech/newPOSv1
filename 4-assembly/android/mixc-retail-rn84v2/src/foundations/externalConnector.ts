import {NativeEventEmitter} from 'react-native';
import type {
  ChannelDescriptor,
  ChannelType,
  ConnectorEvent,
  ConnectorResponse,
} from '@impos2/kernel-core-base';
import NativeConnectorTurboModule from '../supports/apis/NativeConnectorTurboModule';

const emitter = new NativeEventEmitter(NativeConnectorTurboModule);
const streamSubs = new Map<string, {remove: () => void}>();

export const externalConnectorAdapter = {
  call<T = any>(
    channel: ChannelDescriptor,
    action: string,
    params?: Record<string, any>,
    timeout?: number,
  ): Promise<ConnectorResponse<T>> {
    return NativeConnectorTurboModule.call(
      JSON.stringify(channel),
      action,
      JSON.stringify(params ?? {}),
      timeout ?? 30000,
    ) as Promise<ConnectorResponse<T>>;
  },

  subscribe(
    channel: ChannelDescriptor,
    onEvent: (event: ConnectorEvent) => void,
    onError?: (error: ConnectorEvent) => void,
  ): Promise<string> {
    return NativeConnectorTurboModule.subscribe(JSON.stringify(channel)).then((channelId: string) => {
      const sub = emitter.addListener('connector.stream', (event: ConnectorEvent) => {
        if (event.channelId !== channelId) return;
        if (event.data == null) {
          onError?.(event);
        } else {
          onEvent(event);
        }
      });
      streamSubs.set(channelId, sub);
      return channelId;
    });
  },

  unsubscribe(channelId: string): Promise<void> {
    streamSubs.get(channelId)?.remove();
    streamSubs.delete(channelId);
    return NativeConnectorTurboModule.unsubscribe(channelId);
  },

  on(eventType: string, handler: (event: ConnectorEvent) => void): () => void {
    const sub = emitter.addListener(eventType, handler);
    return () => sub.remove();
  },

  isAvailable(channel: ChannelDescriptor): Promise<boolean> {
    return NativeConnectorTurboModule.isAvailable(JSON.stringify(channel));
  },

  getAvailableTargets(type: ChannelType): Promise<string[]> {
    return NativeConnectorTurboModule.getAvailableTargets(type) as Promise<string[]>;
  },
};
