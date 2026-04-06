import type {
  ChannelDescriptor,
  ChannelType,
  ConnectorEvent,
  ConnectorResponse,
  DeviceInfo,
  PowerStatusChangeEvent,
  ScriptExecutionOptions,
  SystemStatus,
} from '@impos2/kernel-core-base';
import type {
  LocalWebServerConfig,
  LocalWebServerInfo,
  ServerStats,
} from '@impos2/kernel-core-interconnection';

import type {LaunchContext} from './index';

export const hostBridgeInvokeChannel = 'impos2:host-bridge:invoke';
export const hostBridgeEventChannel = 'impos2:host-bridge:event';

export type HostBridgeHttpRequest = {
  url?: string;
  baseURL?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
  responseType?: 'json' | 'text';
};

export type HostBridgeHttpResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
};

export type HostBridgeInvokeMethod =
  | 'getLaunchContext'
  | 'appControl.isFullScreen'
  | 'appControl.isAppLocked'
  | 'appControl.setFullScreen'
  | 'appControl.setAppLocked'
  | 'appControl.restartApp'
  | 'appControl.onAppLoadComplete'
  | 'device.getDeviceInfo'
  | 'device.getSystemStatus'
  | 'device.subscribePowerStatus'
  | 'device.unsubscribePowerStatus'
  | 'stateStorage.getItem'
  | 'stateStorage.setItem'
  | 'stateStorage.removeItem'
  | 'logger.debug'
  | 'logger.log'
  | 'logger.warn'
  | 'logger.error'
  | 'logger.getLogFiles'
  | 'logger.getLogContent'
  | 'logger.deleteLogFile'
  | 'logger.clearAllLogs'
  | 'logger.getLogDirPath'
  | 'localWebServer.start'
  | 'localWebServer.stop'
  | 'localWebServer.getStatus'
  | 'localWebServer.getStats'
  | 'localWebServer.register'
  | 'http.request'
  | 'scriptsExecution.executeScript'
  | 'externalConnector.call'
  | 'externalConnector.subscribe'
  | 'externalConnector.unsubscribe'
  | 'externalConnector.isAvailable'
  | 'externalConnector.getAvailableTargets';

export type HostBridgeEventType = 'device.powerStatusChanged' | 'externalConnector.stream' | 'externalConnector.passive';

export type HostBridgeEventPayloadMap = {
  'device.powerStatusChanged': {
    listenerId: string;
    event: PowerStatusChangeEvent;
  };
  'externalConnector.stream': {
    channelId: string;
    event: ConnectorEvent;
  };
  'externalConnector.passive': {
    eventType: string;
    event: ConnectorEvent;
  };
};

export interface HostBridgeApi {
  getLaunchContext(): Promise<LaunchContext>;
  appControl: {
    isFullScreen(): Promise<boolean>;
    isAppLocked(): Promise<boolean>;
    setFullScreen(isFullScreen: boolean): Promise<void>;
    setAppLocked(isAppLocked: boolean): Promise<void>;
    restartApp(): Promise<void>;
    onAppLoadComplete(displayIndex: number): Promise<void>;
  };
  device: {
    getDeviceInfo(): Promise<DeviceInfo>;
    getSystemStatus(): Promise<SystemStatus>;
    subscribePowerStatus(listenerId: string): Promise<PowerStatusChangeEvent>;
    unsubscribePowerStatus(listenerId: string): Promise<void>;
  };
  stateStorage: {
    getItem(key: string, ...args: unknown[]): Promise<unknown>;
    setItem(key: string, value: unknown, ...args: unknown[]): Promise<void>;
    removeItem(key: string, ...args: unknown[]): Promise<void>;
  };
  logger: {
    debug(tags: string[], message: string, data?: unknown): Promise<void>;
    log(tags: string[], message: string, data?: unknown): Promise<void>;
    warn(tags: string[], message: string, data?: unknown): Promise<void>;
    error(tags: string[], message: string, data?: unknown): Promise<void>;
    getLogFiles(): Promise<unknown[]>;
    getLogContent(fileName: string): Promise<string>;
    deleteLogFile(fileName: string): Promise<boolean>;
    clearAllLogs(): Promise<boolean>;
    getLogDirPath(): Promise<string>;
  };
  localWebServer: {
    start(config?: Partial<LocalWebServerConfig>): Promise<Array<{name: string; address: string}>>;
    stop(): Promise<void>;
    getStatus(): Promise<LocalWebServerInfo>;
    getStats(): Promise<ServerStats>;
    register(payload: Record<string, unknown>): Promise<{status: number; data: unknown}>;
  };
  http: {
    request<T = unknown>(request: HostBridgeHttpRequest): Promise<HostBridgeHttpResponse<T>>;
  };
  scriptsExecution: {
    executeScript<T = unknown>(options: ScriptExecutionOptions<T>): Promise<T>;
  };
  externalConnector: {
    call<T = unknown>(
      channel: ChannelDescriptor,
      action: string,
      params?: Record<string, unknown>,
      timeout?: number,
    ): Promise<ConnectorResponse<T>>;
    subscribe(channel: ChannelDescriptor): Promise<string>;
    unsubscribe(channelId: string): Promise<void>;
    isAvailable(channel: ChannelDescriptor): Promise<boolean>;
    getAvailableTargets(type: ChannelType): Promise<string[]>;
  };
  events: {
    on<TEventType extends HostBridgeEventType>(
      eventType: TEventType,
      handler: (payload: HostBridgeEventPayloadMap[TEventType]) => void,
    ): () => void;
  };
}
