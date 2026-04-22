import { LocalWebServerConfig, LocalWebServerInfo, ServerStats } from "../../types/foundations/localWebServer";
import { ServerAddress } from "../../types";
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
export declare const localWebServer: LocalWebServer;
export declare function registerLocalWebServer(localWebServer: LocalWebServer): void;
//# sourceMappingURL=localWebServer.d.ts.map