import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type LocalWebServerConfig = {
  port?: number;
  basePath?: string;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  retryCacheTimeout?: number;
};

export type NetworkAddress = {
  name: string;
  address: string;
};

export type LocalWebServerStatusResult = {
  status: string;
  addresses: NetworkAddress[];
  config?: {
    port: number;
    basePath: string;
    heartbeatInterval: number;
    heartbeatTimeout: number;
  };
  error?: string;
};

export type LocalWebServerStatsResult = {
  masterCount: number;
  slaveCount: number;
  pendingCount: number;
  uptime: number;
};

export type StartResult = {
  status: string;
  addresses: NetworkAddress[];
  config: {
    port: number;
    basePath: string;
    heartbeatInterval: number;
    heartbeatTimeout: number;
  };
  error?: string;
};

export interface Spec extends TurboModule {
  startLocalWebServer(config: LocalWebServerConfig): Promise<StartResult>;
  stopLocalWebServer(): Promise<void>;
  getLocalWebServerStatus(): Promise<LocalWebServerStatusResult>;
  getLocalWebServerStats(): Promise<LocalWebServerStatsResult>;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'LocalWebServerTurboModule',
);
