import { LocalWebServer, LocalWebServerConfig, LocalWebServerInfo, LocalWebServerStatus, ServerStats } from '@impos2/kernel-core-interconnection'

const DEFAULT_CONFIG: LocalWebServerConfig = {
    port: 8888,
    basePath: '/localServer',
    heartbeatInterval: 30000,
    heartbeatTimeout: 60000,
}

export const localWebServerAdapter: LocalWebServer = {
    async startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<any> {
        const merged = { ...DEFAULT_CONFIG, ...config }
        const result = await window.electronBridge.invoke('localWebServer:start', merged)
        return result.addresses ?? []
    },

    async stopLocalWebServer(): Promise<void> {
        await window.electronBridge.invoke('localWebServer:stop')
    },

    async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
        const r = await window.electronBridge.invoke('localWebServer:getStatus')
        return {
            status: (r.status as LocalWebServerStatus) ?? LocalWebServerStatus.STOPPED,
            addresses: r.addresses ?? [],
            config: r.config ?? DEFAULT_CONFIG,
            error: r.error ?? undefined,
        }
    },

    async getLocalWebServerStats(): Promise<ServerStats> {
        return window.electronBridge.invoke('localWebServer:getStats')
    },
}
