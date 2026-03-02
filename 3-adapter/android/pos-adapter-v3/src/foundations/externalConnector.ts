import {NativeEventEmitter} from 'react-native'
import type {
    ExternalConnector,
    ChannelType,
    ChannelDescriptor,
    ConnectorEvent,
    ConnectorResponse,
} from '@impos2/kernel-core-base'
import NativeConnectorTurboModule from '../specs/NativeConnectorTurboModule'

/**
 * ExternalConnector 适配器实现
 * 基于协程优化的 TurboModule，支持 8 种通道类型 × 3 种交互模式
 */
export class ExternalConnectorAdapter implements ExternalConnector {
    private emitter: NativeEventEmitter | null = null
    private streamSubs = new Map<string, ReturnType<NativeEventEmitter['addListener']>>()
    private passiveSubs = new Map<string, ReturnType<NativeEventEmitter['addListener']>>()

    private getEmitter(): NativeEventEmitter {
        if (!this.emitter) {
            this.emitter = new NativeEventEmitter(NativeConnectorTurboModule)
        }
        return this.emitter
    }

    async call<T = any>(
        channel: ChannelDescriptor,
        action: string,
        params?: Record<string, any>,
        timeout?: number
    ): Promise<ConnectorResponse<T>> {
        try {
            const responseJson = await NativeConnectorTurboModule.call(
                JSON.stringify(channel),
                action,
                JSON.stringify(params ?? {}),
                timeout ?? 30000
            )
            return JSON.parse(responseJson) as ConnectorResponse<T>
        } catch (error) {
            // 将原生异常转换为标准响应格式
            return {
                success: false,
                code: 9999,
                message: error instanceof Error ? error.message : String(error),
                duration: 0,
                timestamp: Date.now(),
            }
        }
    }

    async subscribe(
        channel: ChannelDescriptor,
        onEvent: (event: ConnectorEvent) => void,
        onError?: (error: ConnectorEvent) => void
    ): Promise<string> {
        try {
            const channelId = await NativeConnectorTurboModule.subscribe(
                JSON.stringify(channel)
            )

            const sub = this.getEmitter().addListener(
                'connector.stream',
                (event: ConnectorEvent) => {
                    if (event.channelId !== channelId) return

                    if (event.data === null) {
                        onError?.(event)
                    } else {
                        onEvent(event)
                    }
                }
            )

            this.streamSubs.set(channelId, sub)
            return channelId
        } catch (error) {
            throw new Error(
                `Failed to subscribe: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async unsubscribe(channelId: string): Promise<void> {
        const sub = this.streamSubs.get(channelId)
        if (sub) {
            sub.remove()
            this.streamSubs.delete(channelId)
        }
        await NativeConnectorTurboModule.unsubscribe(channelId)
    }

    on(eventType: string, handler: (event: ConnectorEvent) => void): () => void {
        const sub = this.getEmitter().addListener('connector.passive', (event: ConnectorEvent) => {
            // 根据 eventType 过滤（eventType 可以是 action 或自定义标识）
            if (event.target === eventType || event.type === eventType) {
                handler(event)
            }
        })

        const key = `passive_${eventType}_${Date.now()}`
        this.passiveSubs.set(key, sub)

        return () => {
            sub.remove()
            this.passiveSubs.delete(key)
        }
    }

    async isAvailable(channel: ChannelDescriptor): Promise<boolean> {
        try {
            return await NativeConnectorTurboModule.isAvailable(JSON.stringify(channel))
        } catch {
            return false
        }
    }

    async getAvailableTargets(type: ChannelType): Promise<string[]> {
        try {
            return await NativeConnectorTurboModule.getAvailableTargets(type)
        } catch {
            return []
        }
    }
}

export const externalConnectorAdapter = new ExternalConnectorAdapter()

/**
 * 清理所有订阅（用于热重载）
 */
export function cleanupExternalConnector(): void {
    const adapter = externalConnectorAdapter as ExternalConnectorAdapter
    adapter['streamSubs'].forEach(sub => sub.remove())
    adapter['streamSubs'].clear()
    adapter['passiveSubs'].forEach(sub => sub.remove())
    adapter['passiveSubs'].clear()
    adapter['emitter'] = null
}
