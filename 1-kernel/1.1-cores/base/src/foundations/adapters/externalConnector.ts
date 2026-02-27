import {
    ChannelType,
    ChannelDescriptor,
    ConnectorEvent,
    ConnectorResponse,
} from '../../types/foundations/externalConnector'

export interface ExternalConnector {
    /**
     * 模式一：Request-Response
     * 一次调用，一次响应，适合支付/打印/查询
     */
    call<T = any>(
        channel: ChannelDescriptor,
        action: string,
        params?: Record<string, any>,
        timeout?: number
    ): Promise<ConnectorResponse<T>>

    /**
     * 模式二：Subscribe（订阅推送）
     * 开启持续监听，硬件每次产生数据都推送事件
     * @returns channelId，用于 unsubscribe
     */
    subscribe(
        channel: ChannelDescriptor,
        onEvent: (event: ConnectorEvent) => void,
        onError?: (error: ConnectorEvent) => void
    ): Promise<string>

    /**
     * 取消订阅
     */
    unsubscribe(channelId: string): Promise<void>

    /**
     * 模式三：Passive（被动接收）
     * 监听外部程序主动调用本 APP 的事件（Intent、AIDL 回调等）
     * @returns off 函数，调用后取消监听
     */
    on(
        eventType: string,
        handler: (event: ConnectorEvent) => void
    ): () => void

    /**
     * 检查通道是否可用
     */
    isAvailable(channel: ChannelDescriptor): Promise<boolean>

    /**
     * 获取指定类型下所有可用的 target 列表
     */
    getAvailableTargets(type: ChannelType): Promise<string[]>
}

let registeredExternalConnector: ExternalConnector | null = null

export const externalConnector: ExternalConnector = {
    call(channel, action, params, timeout) {
        if (!registeredExternalConnector) {
            return Promise.resolve({
                success: false,
                code: 9999,
                message: 'ExternalConnector not registered',
                duration: 0,
                timestamp: Date.now(),
            })
        }
        return registeredExternalConnector.call(channel, action, params, timeout)
    },
    subscribe(channel, onEvent, onError) {
        if (!registeredExternalConnector) return Promise.resolve('')
        return registeredExternalConnector.subscribe(channel, onEvent, onError)
    },
    unsubscribe(channelId) {
        if (!registeredExternalConnector) return Promise.resolve()
        return registeredExternalConnector.unsubscribe(channelId)
    },
    on(eventType, handler) {
        if (!registeredExternalConnector) return () => {}
        return registeredExternalConnector.on(eventType, handler)
    },
    isAvailable(channel) {
        if (!registeredExternalConnector) return Promise.resolve(false)
        return registeredExternalConnector.isAvailable(channel)
    },
    getAvailableTargets(type) {
        if (!registeredExternalConnector) return Promise.resolve([])
        return registeredExternalConnector.getAvailableTargets(type)
    },
}

export const registerExternalConnector = (impl: ExternalConnector): void => {
    registeredExternalConnector = impl
}
