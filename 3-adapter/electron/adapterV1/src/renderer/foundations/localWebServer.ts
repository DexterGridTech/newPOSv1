import {
  type LocalWebServer,
  type LocalWebServerInfo,
  type LocalWebServerConfig,
  type ServerStats,
} from '@impos2/kernel-core-interconnection';
import {getHostBridge} from './hostBridge';

export const localWebServerAdapter: LocalWebServer = {
  startLocalWebServer(config?: Partial<LocalWebServerConfig>) {
    return getHostBridge().localWebServer.start(config);
  },
  stopLocalWebServer(): Promise<void> {
    return getHostBridge().localWebServer.stop();
  },
  getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
    return getHostBridge().localWebServer.getStatus();
  },
  getLocalWebServerStats(): Promise<ServerStats> {
    return getHostBridge().localWebServer.getStats();
  },
};
