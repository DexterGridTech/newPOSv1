// import {NativeModules} from 'react-native'
// import {LocalWebServer, LocalWebServerConfig, LocalWebServerInfo, LocalWebServerStatus, ServerStats} from '@impos2/kernel-core-interconnection'
//
// const {LocalWebServerTurboModule} = NativeModules
//
// const DEFAULT_CONFIG: LocalWebServerConfig = {
//     port: 8888,
//     basePath: '/localServer',
//     heartbeatInterval: 30000,
//     heartbeatTimeout: 60000,
// }
//
// export const localWebServerAdapter: LocalWebServer = {
//     async startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<any> {
//         const merged = {...DEFAULT_CONFIG, ...config}
//         const result = await LocalWebServerTurboModule.startLocalWebServer(merged)
//         return result.addresses ?? []
//     },
//
//     async stopLocalWebServer(): Promise<void> {
//         await LocalWebServerTurboModule.stopLocalWebServer()
//     },
//
//     async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
//         const r = await LocalWebServerTurboModule.getLocalWebServerStatus()
//         return {
//             status: (r.status as LocalWebServerStatus) ?? LocalWebServerStatus.STOPPED,
//             addresses: r.addresses ?? [],
//             config: r.config ?? DEFAULT_CONFIG,
//             error: r.error ?? undefined,
//         }
//     },
//
//     async getLocalWebServerStats(): Promise<ServerStats> {
//         return LocalWebServerTurboModule.getLocalWebServerStats()
//     },
// }
