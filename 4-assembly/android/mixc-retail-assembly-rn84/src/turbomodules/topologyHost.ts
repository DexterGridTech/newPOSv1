import NativeTopologyHostTurboModule from './specs/NativeTopologyHostTurboModule'

export interface NativeTopologyHostAddressInfo {
    host: string
    port: number
    basePath: string
    httpBaseUrl: string
    wsUrl: string
    localHttpBaseUrl?: string
    localWsUrl?: string
}

export const nativeTopologyHost = {
    async start(config: Record<string, unknown> = {}): Promise<NativeTopologyHostAddressInfo> {
        return JSON.parse(await NativeTopologyHostTurboModule.startTopologyHost(JSON.stringify(config))) as NativeTopologyHostAddressInfo
    },
    async prepareLaunch(displayCount: number): Promise<Record<string, unknown>> {
        return JSON.parse(await NativeTopologyHostTurboModule.prepareTopologyLaunch(displayCount)) as Record<string, unknown>
    },
    async stop(): Promise<void> {
        await NativeTopologyHostTurboModule.stopTopologyHost()
    },
    async getStatus(): Promise<Record<string, unknown>> {
        return JSON.parse(await NativeTopologyHostTurboModule.getTopologyHostStatus()) as Record<string, unknown>
    },
    async getStats(): Promise<Record<string, unknown>> {
        return JSON.parse(await NativeTopologyHostTurboModule.getTopologyHostStats()) as Record<string, unknown>
    },
    async replaceFaultRules(rules: readonly Record<string, unknown>[]): Promise<Record<string, unknown>> {
        return JSON.parse(await NativeTopologyHostTurboModule.replaceTopologyFaultRules(JSON.stringify(rules))) as Record<string, unknown>
    },
    async getDiagnosticsSnapshot(): Promise<Record<string, unknown> | null> {
        const snapshot = await NativeTopologyHostTurboModule.getDiagnosticsSnapshot()
        return snapshot == null ? null : JSON.parse(snapshot) as Record<string, unknown>
    },
}
