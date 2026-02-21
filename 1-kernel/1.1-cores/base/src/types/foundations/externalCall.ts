
/**
 * 调用类型枚举
 */
export enum CallType {
    APP = 'APP',           // 第三方应用
    HARDWARE = 'HARDWARE', // 硬件设备
    SYSTEM = 'SYSTEM'      // 系统服务
}

/**
 * 调用方式枚举
 */
export enum CallMethod {
    INTENT = 'INTENT',         // Android Intent
    AIDL = 'AIDL',            // AIDL接口
    SDK = 'SDK',              // 第三方SDK
    SERIAL = 'SERIAL',        // 串口通信
    USB = 'USB',              // USB通信
    BLUETOOTH = 'BLUETOOTH',  // 蓝牙通信
    NETWORK = 'NETWORK'       // 网络通信
}

/**
 * 标准错误码
 */
export enum ErrorCode {
    SUCCESS = 0,                    // 成功
    TIMEOUT = 1001,                 // 超时
    CANCELLED = 1002,               // 用户取消
    NOT_FOUND = 2001,               // 目标未找到
    NOT_SUPPORTED = 2002,           // 不支持的操作
    PERMISSION_DENIED = 3001,       // 权限拒绝
    DEVICE_NOT_READY = 4001,        // 设备未就绪
    DEVICE_BUSY = 4002,             // 设备忙碌
    COMMUNICATION_ERROR = 5001,     // 通信错误
    INVALID_PARAMS = 6001,          // 参数错误
    INVALID_RESPONSE = 6002,        // 响应格式错误
    UNKNOWN_ERROR = 9999            // 未知错误
}

/**
 * 通用调用请求参数
 * 业务层定义接口，适配层实现
 */
export interface ExternalCallRequest {
    // 请求ID（可选，用于取消请求）
    requestId?: string;

    // 调用类型
    type: CallType;

    // 调用方式
    method: CallMethod;

    // 目标标识（App包名、设备ID、服务名等）
    target: string;

    // 操作/动作（如：支付、打印、扫码等）
    action: string;

    // 请求参数（JSON可序列化对象）
    params?: Record<string, any>;

    // 超时时间（毫秒，默认30000）
    timeout?: number;

    // 额外配置
    options?: {
        // 重试次数
        retryCount?: number;
        // 重试间隔（毫秒）
        retryInterval?: number;
        // 自定义元数据
        metadata?: Record<string, any>;
    };
}

/**
 * 通用调用响应结果
 * 业务层定义接口，适配层返回标准化的响应格式
 */
export interface ExternalCallResponse<T = any> {
    // 错误码
    code: ErrorCode;

    // 是否成功
    success: boolean;

    // 消息
    message: string;

    // 响应数据
    data?: T;

    // 原始响应（用于调试）
    raw?: any;

    // 时间戳
    timestamp: number;

    // 耗时（毫秒）
    duration: number;
}