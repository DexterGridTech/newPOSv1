import {LocalWebServer, LocalWebServerConfig, LocalWebServerInfo, LocalWebServerStatus, ServerStats} from '@impos2/kernel-core-interconnection'

const DEFAULT_CONFIG: LocalWebServerConfig = {
    port: 8888,
    basePath: '/localServer',
    heartbeatInterval: 30000,
    heartbeatTimeout: 60000,
}

// Stub: LocalWebServerTurboModule 尚未实现
export const localWebServerAdapter: LocalWebServer = {
    async startLocalWebServer(_config?: Partial<LocalWebServerConfig>): Promise<any> {
        return []
    },

    async stopLocalWebServer(): Promise<void> {},

    async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
        return {
            status: LocalWebServerStatus.STOPPED,
            addresses: [],
            config: DEFAULT_CONFIG,
            error: undefined,
        }
    },

    async getLocalWebServerStats(): Promise<ServerStats> {
        return {
            totalRequests: 0,
            activeConnections: 0,
            uptime: 0,
        } as ServerStats
    },
}
