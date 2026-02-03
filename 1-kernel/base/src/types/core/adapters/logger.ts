/**
 * 日志文件信息
 */
export interface LogFile {
    /** 文件名 */
    name: string;
    /** 文件路径 */
    path: string;
    /** 文件大小（字节） */
    size: number;
    /** 最后修改时间（时间戳） */
    lastModified: number;
}

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

    /**
     * 获取所有日志文件列表
     */
    getLogFiles(): Promise<LogFile[]>;

    /**
     * 读取指定日志文件内容
     * @param fileName 文件名
     */
    getLogContent(fileName: string): Promise<string>;

    /**
     * 删除指定日志文件
     * @param fileName 文件名
     */
    deleteLogFile(fileName: string): Promise<boolean>;

    /**
     * 清空所有日志文件
     */
    clearAllLogs(): Promise<boolean>;

    /**
     * 获取日志目录路径
     */
    getLogDirPath(): Promise<string>;
}