import {
  type LocalWebServer,
  type LocalWebServerConfig,
  type LocalWebServerInfo,
  LocalWebServerStatus,
  type ServerStats,
} from '@impos2/kernel-core-interconnection';
import NativeLocalWebServerTurboModule from '../supports/apis/NativeLocalWebServerTurboModule';

const DEFAULT_CONFIG: LocalWebServerConfig = {
  port: 8888,
  basePath: '/localServer',
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
};

export const localWebServerAdapter: LocalWebServer = {
  async startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<any> {
    const merged = {...DEFAULT_CONFIG, ...config};
    const result = await NativeLocalWebServerTurboModule.startLocalWebServer(JSON.stringify(merged));
    return (result as {addresses?: unknown[]}).addresses ?? [];
  },

  async stopLocalWebServer(): Promise<void> {
    await NativeLocalWebServerTurboModule.stopLocalWebServer();
  },

  async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
    const result = (await NativeLocalWebServerTurboModule.getLocalWebServerStatus()) as {
      status?: LocalWebServerStatus;
      addresses?: LocalWebServerInfo['addresses'];
      config?: LocalWebServerConfig;
      error?: string;
    };

    return {
      status: result.status ?? LocalWebServerStatus.STOPPED,
      addresses: result.addresses ?? [],
      config: result.config ?? DEFAULT_CONFIG,
      error: result.error ?? undefined,
    };
  },

  async getLocalWebServerStats(): Promise<ServerStats> {
    return NativeLocalWebServerTurboModule.getLocalWebServerStats() as Promise<ServerStats>;
  },
};
