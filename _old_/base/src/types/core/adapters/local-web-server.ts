
import {ServerAddress} from "../base";

/**
 * 本地 Web 服务器配置
 */
export interface LocalWebServerConfig {
    /** 服务器端口 */
    port: number;
    /** 基础路径 */
    basePath: string;
    /** 心跳间隔（毫秒） */
    heartbeatInterval: number;
    /** 心跳超时（毫秒） */
    heartbeatTimeout: number;
}

/**
 * 服务器状态
 */
export enum LocalWebServerStatus {
    /** 未启动 */
    STOPPED = 'STOPPED',
    /** 启动中 */
    STARTING = 'STARTING',
    /** 运行中 */
    RUNNING = 'RUNNING',
    /** 停止中 */
    STOPPING = 'STOPPING',
    /** 错误 */
    ERROR = 'ERROR',
}

/**
 * 服务器信息
 */
export interface LocalWebServerInfo {
    /** 服务器状态 */
    status: LocalWebServerStatus;
    /** 服务器地址列表 */
    addresses: ServerAddress[];
    /** 配置信息 */
    config: LocalWebServerConfig;
    /** 错误信息（如果有） */
    error?: string;
}

/**
 * 服务器统计信息
 */
export interface ServerStats {
    /** Master 设备数量 */
    masterCount: number;
    /** Slave 设备数量 */
    slaveCount: number;
    /** 待注册设备数量 */
    pendingCount: number;
    /** 服务器运行时间（毫秒） */
    uptime: number;
}


export interface ILocalWebServerAdapter {

    /**
     * 启动本地 Web 服务器
     * @param config 服务器配置（可选）
     * @returns Promise<ServerAddress[]> 服务器地址列表
     */
    startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<ServerAddress[]>;

    /**
     * 停止本地 Web 服务器
     * @returns Promise<void>
     */
    stopLocalWebServer(): Promise<void>;

    /**
     * 获取本地 Web 服务器状态
     * @returns Promise<LocalWebServerInfo> 服务器状态信息
     */
    getLocalWebServerStatus(): Promise<LocalWebServerInfo>;

    /**
     * 获取本地 Web 服务器统计信息
     * @returns Promise<ServerStats> 服务器统计信息
     */
    getLocalWebServerStats(): Promise<ServerStats>;
}