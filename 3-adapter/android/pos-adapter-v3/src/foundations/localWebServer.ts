import NativeLocalWebServerTurboModule from '../specs/NativeLocalWebServerTurboModule'
import type {LocalWebServer, LocalWebServerConfig, LocalWebServerInfo, ServerStats} from '@impos2/kernel-core-interconnection'

const DEFAULT_CONFIG: LocalWebServerConfig = {
    port: 8888,
    basePath: '/localServer',
    heartbeatInterval: 30000,
    heartbeatTimeout: 60000,
}

export const localWebServerAdapter: LocalWebServer = {
    async startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<any> {
        const merged = {...DEFAULT_CONFIG, ...config}
        const result = await NativeLocalWebServerTurboModule.startLocalWebServer(merged)
        return result.addresses ?? []
    },

    async stopLocalWebServer(): Promise<void> {
        await NativeLocalWebServerTurboModule.stopLocalWebServer()
    },

    async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
        const r = await NativeLocalWebServerTurboModule.getLocalWebServerStatus()
        return {
            status: r.status as any,
            addresses: r.addresses ?? [],
            config: r.config ?? DEFAULT_CONFIG,
            error: r.error ?? undefined,
        }
    },

    async getLocalWebServerStats(): Promise<ServerStats> {
        return NativeLocalWebServerTurboModule.getLocalWebServerStats()
    },
}
