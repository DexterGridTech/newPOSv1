import {LocalWebServerConfig, LocalWebServerInfo, LocalWebServerStatus, ServerStats} from "../../types/foundations/localWebServer";
import {ServerAddress} from "../../types";
import {testServerAddresses} from "../masterServer";

export interface LocalWebServer {

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

export const localWebServer: LocalWebServer = {
    startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<ServerAddress[]> {
        if (!registeredLocalWebServer) {
            return Promise.resolve(testServerAddresses)
        }
        return registeredLocalWebServer.startLocalWebServer(config);
    },
    stopLocalWebServer(): Promise<void> {
        if (!registeredLocalWebServer) return Promise.resolve();
        return registeredLocalWebServer.stopLocalWebServer();
    },
    getLocalWebServerStats(): Promise<ServerStats> {
        if (!registeredLocalWebServer) return Promise.resolve({masterCount: 0, slaveCount: 0, pendingCount: 0, uptime: 0});
        return registeredLocalWebServer.getLocalWebServerStats();
    },
    getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
        if (!registeredLocalWebServer) return Promise.resolve({
            status: LocalWebServerStatus.STOPPED,
            addresses: [],
            config: {port: 0, basePath: '', heartbeatInterval: 0, heartbeatTimeout: 0},
        });
        return registeredLocalWebServer.getLocalWebServerStatus();
    }
}
let registeredLocalWebServer: LocalWebServer | undefined;

export function registerLocalWebServer(localWebServer: LocalWebServer) {
    registeredLocalWebServer = localWebServer;
}