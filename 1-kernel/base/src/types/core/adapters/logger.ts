

export interface ILoggerAdapter {
    /**
     * 调试日志
     * @param tag 日志标签
     * @param message 日志消息
     * @param data 附加数据（可选）
     */
    debug(tag: string, message: string, data?: any): void;

    /**
     * 普通日志
     * @param tag 日志标签
     * @param message 日志消息
     * @param data 附加数据（可选）
     */
    log(tag: string, message: string, data?: any): void;

    /**
     * 警告日志
     * @param tag 日志标签
     * @param message 日志消息
     * @param data 附加数据（可选）
     */
    warn(tag: string, message: string, data?: any): void;

    /**
     * 错误日志
     * @param tag 日志标签
     * @param message 日志消息
     * @param error 错误对象（可选）
     */
    error(tag: string, message: string, error?: any): void;
}