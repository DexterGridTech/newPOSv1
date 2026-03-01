// import { NativeModules, NativeEventEmitter } from 'react-native'
// import {
//     ExternalConnector,
//     ChannelType,
//     ChannelDescriptor,
//     ConnectorEvent,
//     ConnectorResponse,
// } from '@impos2/kernel-core-base'
//
// // 延迟初始化，避免模块加载时 TurboModule 尚未注册导致崩溃
// let _emitter: NativeEventEmitter | null = null
// function getEmitter(): NativeEventEmitter {
//     if (!_emitter) {
//         const mod = NativeModules.ConnectorTurboModule
//         if (!mod) throw new Error('[ExternalConnector] ConnectorTurboModule not registered')
//         _emitter = new NativeEventEmitter(mod)
//     }
//     return _emitter
// }
//
// function getNativeModule() {
//     const mod = NativeModules.ConnectorTurboModule
//     if (!mod) throw new Error('[ExternalConnector] ConnectorTurboModule not registered')
//     return mod
// }
//
// // channelId → NativeEventEmitter subscription，用于 unsubscribe 时清理
// const streamSubs = new Map<string, { remove: () => void }>()
//
// export const externalConnectorAdapter: ExternalConnector = {
//     call<T = any>(
//         channel: ChannelDescriptor,
//         action: string,
//         params?: Record<string, any>,
//         timeout?: number
//     ): Promise<ConnectorResponse<T>> {
//         return getNativeModule().call(
//             JSON.stringify(channel),
//             action,
//             JSON.stringify(params ?? {}),
//             timeout ?? 30000
//         )
//     },
//
//     subscribe(
//         channel: ChannelDescriptor,
//         onEvent: (event: ConnectorEvent) => void,
//         onError?: (error: ConnectorEvent) => void
//     ): Promise<string> {
//         return getNativeModule().subscribe(JSON.stringify(channel))
//             .then((channelId: string) => {
//                 const sub = getEmitter().addListener('connector.stream', (event: ConnectorEvent) => {
//                     if (event.channelId !== channelId) return
//                     if (event.data == null) {
//                         onError?.(event)
//                     } else {
//                         onEvent(event)
//                     }
//                 })
//                 streamSubs.set(channelId, sub)
//                 return channelId
//             })
//     },
//
//     unsubscribe(channelId: string): Promise<void> {
//         streamSubs.get(channelId)?.remove()
//         streamSubs.delete(channelId)
//         return getNativeModule().unsubscribe(channelId)
//     },
//
//     on(eventType: string, handler: (event: ConnectorEvent) => void): () => void {
//         const sub = getEmitter().addListener(eventType, handler)
//         return () => sub.remove()
//     },
//
//     isAvailable(channel: ChannelDescriptor): Promise<boolean> {
//         return getNativeModule().isAvailable(JSON.stringify(channel))
//     },
//
//     getAvailableTargets(type: ChannelType): Promise<string[]> {
//         return getNativeModule().getAvailableTargets(type)
//     },
// }
//
// /** 模块卸载时清理所有残留订阅（防止热重载后内存泄漏） */
// export function cleanupExternalConnector(): void {
//     streamSubs.forEach(sub => sub.remove())
//     streamSubs.clear()
//     _emitter = null
// }
