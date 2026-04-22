import { ChannelType, ChannelDescriptor, ConnectorEvent, ConnectorResponse } from '../../types/foundations/externalConnector';
export interface ExternalConnector {
    /**
     * 模式一：Request-Response
     * 一次调用，一次响应，适合支付/打印/查询
     */
    call<T = any>(channel: ChannelDescriptor, action: string, params?: Record<string, any>, timeout?: number): Promise<ConnectorResponse<T>>;
    /**
     * 模式二：Subscribe（订阅推送）
     * 开启持续监听，硬件每次产生数据都推送事件
     * @returns channelId，用于 unsubscribe
     */
    subscribe(channel: ChannelDescriptor, onEvent: (event: ConnectorEvent) => void, onError?: (error: ConnectorEvent) => void): Promise<string>;
    /**
     * 取消订阅
     */
    unsubscribe(channelId: string): Promise<void>;
    /**
     * 模式三：Passive（被动接收）
     * 监听外部程序主动调用本 APP 的事件（Intent、AIDL 回调等）
     * @returns off 函数，调用后取消监听
     */
    on(eventType: string, handler: (event: ConnectorEvent) => void): () => void;
    /**
     * 检查通道是否可用
     */
    isAvailable(channel: ChannelDescriptor): Promise<boolean>;
    /**
     * 获取指定类型下所有可用的 target 列表
     */
    getAvailableTargets(type: ChannelType): Promise<string[]>;
}
export declare const externalConnector: ExternalConnector;
export declare const registerExternalConnector: (impl: ExternalConnector) => void;
//# sourceMappingURL=externalConnector.d.ts.map