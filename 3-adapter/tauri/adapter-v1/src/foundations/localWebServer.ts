import { invoke } from '@tauri-apps/api/core'
import {
    LocalWebServer,
    LocalWebServerConfig,
    LocalWebServerInfo,
    LocalWebServerStatus,
    ServerStats,
} from '@impos2/kernel-core-interconnection'

const DEFAULT_CONFIG: LocalWebServerConfig = {
    port: 8888,
    basePath: '/localServer',
    heartbeatInterval: 30000,
    heartbeatTimeout: 60000,
}

export const localWebServerAdapter: LocalWebServer = {
    async startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<any> {
        const merged = { ...DEFAULT_CONFIG, ...config }
        const result = await invoke<{ addresses: string[] }>('local_web_server_start', { config: merged })
        return result.addresses ?? []
    },

    async stopLocalWebServer(): Promise<void> {
        await invoke('local_web_server_stop')
    },

    async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
        const r = await invoke<{
            status: string
            addresses: string[]
            config: LocalWebServerConfig
            error?: string
        }>('local_web_server_get_status')
        return {
            status: (r.status as LocalWebServerStatus) ?? LocalWebServerStatus.STOPPED,
            addresses: r.addresses ?? [],
            config: r.config ?? DEFAULT_CONFIG,
            error: r.error ?? undefined,
        }
    },

    async getLocalWebServerStats(): Promise<ServerStats> {
        return invoke<ServerStats>('local_web_server_get_stats')
    },
}
