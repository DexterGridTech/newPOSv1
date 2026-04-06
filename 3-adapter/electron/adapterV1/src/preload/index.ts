import {ipcRenderer} from 'electron';

import type {LaunchContext} from '../shared/index';
import {
  hostBridgeEventChannel,
  hostBridgeInvokeChannel,
  type HostBridgeApi,
  type HostBridgeEventPayloadMap,
  type HostBridgeEventType,
  type HostBridgeInvokeMethod,
} from '../shared/contracts';

export type {HostBridgeApi} from '../shared/contracts';

type HostBridgeBridgeOptions = {
  getLaunchContext?: () => Promise<LaunchContext>;
};

function sanitizeForIpc(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value == null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint' || typeof value === 'symbol') {
    return String(value);
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: sanitizeForIpc(value.cause, seen),
    };
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeForIpc(item, seen));
  }

  if (value instanceof Map) {
    return Array.from(value.entries()).map(([key, entryValue]) => [
      sanitizeForIpc(key, seen),
      sanitizeForIpc(entryValue, seen),
    ]);
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map(item => sanitizeForIpc(item, seen));
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as Uint8Array);
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    const output: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      output[key] = sanitizeForIpc(entryValue, seen);
    }
    return output;
  }

  return String(value);
}

function invokeHostBridge<T>(method: HostBridgeInvokeMethod, args: unknown[] = []): Promise<T> {
  return ipcRenderer.invoke(hostBridgeInvokeChannel, {
    method,
    args: sanitizeForIpc(args),
  }) as Promise<T>;
}

function subscribeHostBridgeEvent<TEventType extends HostBridgeEventType>(
  eventType: TEventType,
  handler: (payload: HostBridgeEventPayloadMap[TEventType]) => void,
): () => void {
  const listener = (_event: unknown, payload: {eventType: HostBridgeEventType; data: unknown}) => {
    if (payload.eventType !== eventType) {
      return;
    }
    handler(payload.data as HostBridgeEventPayloadMap[TEventType]);
  };
  ipcRenderer.on(hostBridgeEventChannel, listener);
  return () => {
    ipcRenderer.off(hostBridgeEventChannel, listener);
  };
}

export function createHostBridgeApi(options: HostBridgeBridgeOptions = {}): HostBridgeApi {
  return {
    getLaunchContext: options.getLaunchContext ?? (() => invokeHostBridge('getLaunchContext')),
    appControl: {
      isFullScreen: () => invokeHostBridge('appControl.isFullScreen'),
      isAppLocked: () => invokeHostBridge('appControl.isAppLocked'),
      setFullScreen: (isFullScreen: boolean) => invokeHostBridge('appControl.setFullScreen', [isFullScreen]),
      setAppLocked: (isAppLocked: boolean) => invokeHostBridge('appControl.setAppLocked', [isAppLocked]),
      restartApp: () => invokeHostBridge('appControl.restartApp'),
      onAppLoadComplete: (displayIndex: number) =>
        invokeHostBridge('appControl.onAppLoadComplete', [displayIndex]),
    },
    device: {
      getDeviceInfo: () => invokeHostBridge('device.getDeviceInfo'),
      getSystemStatus: () => invokeHostBridge('device.getSystemStatus'),
      subscribePowerStatus: (listenerId: string) =>
        invokeHostBridge('device.subscribePowerStatus', [listenerId]),
      unsubscribePowerStatus: (listenerId: string) =>
        invokeHostBridge('device.unsubscribePowerStatus', [listenerId]),
    },
    stateStorage: {
      getItem: (key: string, ...args: unknown[]) => invokeHostBridge('stateStorage.getItem', [key, ...args]),
      setItem: (key: string, value: unknown, ...args: unknown[]) =>
        invokeHostBridge('stateStorage.setItem', [key, value, ...args]),
      removeItem: (key: string, ...args: unknown[]) =>
        invokeHostBridge('stateStorage.removeItem', [key, ...args]),
    },
    logger: {
      debug: (tags: string[], message: string, data?: unknown) =>
        invokeHostBridge('logger.debug', [tags, message, data]),
      log: (tags: string[], message: string, data?: unknown) =>
        invokeHostBridge('logger.log', [tags, message, data]),
      warn: (tags: string[], message: string, data?: unknown) =>
        invokeHostBridge('logger.warn', [tags, message, data]),
      error: (tags: string[], message: string, data?: unknown) =>
        invokeHostBridge('logger.error', [tags, message, data]),
      getLogFiles: () => invokeHostBridge('logger.getLogFiles'),
      getLogContent: (fileName: string) => invokeHostBridge('logger.getLogContent', [fileName]),
      deleteLogFile: (fileName: string) => invokeHostBridge('logger.deleteLogFile', [fileName]),
      clearAllLogs: () => invokeHostBridge('logger.clearAllLogs'),
      getLogDirPath: () => invokeHostBridge('logger.getLogDirPath'),
    },
    localWebServer: {
      start: (config?: Record<string, unknown>) => invokeHostBridge('localWebServer.start', [config]),
      stop: () => invokeHostBridge('localWebServer.stop'),
      getStatus: () => invokeHostBridge('localWebServer.getStatus'),
      getStats: () => invokeHostBridge('localWebServer.getStats'),
      register: (payload: Record<string, unknown>) => invokeHostBridge('localWebServer.register', [payload]),
    },
    http: {
      request: request => invokeHostBridge('http.request', [request]),
    },
    scriptsExecution: {
      executeScript: options => invokeHostBridge('scriptsExecution.executeScript', [options]),
    },
    externalConnector: {
      call: (channel, action, params, timeout) =>
        invokeHostBridge('externalConnector.call', [channel, action, params, timeout]),
      subscribe: channel => invokeHostBridge('externalConnector.subscribe', [channel]),
      unsubscribe: channelId => invokeHostBridge('externalConnector.unsubscribe', [channelId]),
      isAvailable: channel => invokeHostBridge('externalConnector.isAvailable', [channel]),
      getAvailableTargets: type => invokeHostBridge('externalConnector.getAvailableTargets', [type]),
    },
    events: {
      on: subscribeHostBridgeEvent,
    },
  };
}
