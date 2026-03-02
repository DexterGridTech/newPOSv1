import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

/**
 * ExternalConnector TurboModule Spec
 * 支持 8 种通道类型 × 3 种交互模式的统一外部连接器
 *
 * @see https://reactnative.dev/docs/the-new-architecture/pillars-turbomodules
 */
export interface Spec extends TurboModule {
    /**
     * Request-Response 模式：一次调用，一次响应
     * @param channelJson - ChannelDescriptor JSON 字符串
     * @param action - 动作名称（如 "GET", "POST", "SEND" 等）
     * @param paramsJson - 参数 JSON 字符串
     * @param timeout - 超时时间（毫秒）
     * @returns ConnectorResponse JSON 字符串
     */
    call(
        channelJson: string,
        action: string,
        paramsJson: string,
        timeout: number
    ): Promise<string>

    /**
     * Stream 模式：订阅持续数据流
     * @param channelJson - ChannelDescriptor JSON 字符串
     * @returns channelId - 通道 ID，用于 unsubscribe 和事件过滤
     */
    subscribe(channelJson: string): Promise<string>

    /**
     * 取消订阅
     * @param channelId - 通道 ID
     */
    unsubscribe(channelId: string): Promise<void>

    /**
     * 检查通道是否可用
     * @param channelJson - ChannelDescriptor JSON 字符串
     * @returns 是否可用
     */
    isAvailable(channelJson: string): Promise<boolean>

    /**
     * 获取指定类型下所有可用的 target 列表
     * @param type - 通道类型（INTENT, USB, SERIAL, BLUETOOTH 等）
     * @returns target 列表（如 USB 设备列表、蓝牙设备列表等）
     */
    getAvailableTargets(type: string): Promise<string[]>

    /**
     * NativeEventEmitter 必需方法
     * @param eventName - 事件名称
     */
    addListener(eventName: string): void

    /**
     * NativeEventEmitter 必需方法
     * @param count - 移除的监听器数量
     */
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('ConnectorTurboModule')
