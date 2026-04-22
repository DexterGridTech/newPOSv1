/**
 * 服务器配置常量
 */
export declare const CONFIG: {
    readonly PORT: 9999;
    readonly HOST: "0.0.0.0";
    readonly DB_PATH: "./data/kernel.db";
    readonly CORS_ORIGIN: "*";
    readonly HEARTBEAT_INTERVAL: 30000;
    readonly HEARTBEAT_TIMEOUT: 60000;
    readonly ROUTES: {
        readonly API: "/kernel-server/api";
        readonly WS: "/kernel-server/ws";
        readonly MANAGER: "/kernel-server/manager";
        readonly WEB: "/kernel-server";
    };
};
//# sourceMappingURL=index.d.ts.map