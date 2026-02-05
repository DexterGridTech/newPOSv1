import { composeWithDevTools } from '@redux-devtools/extension';

/**
 * Redux DevTools 配置
 * 支持远程调试和本地调试
 */
export interface DevToolsOptions {
    /**
     * 是否启用 DevTools
     */
    enabled: boolean;

    /**
     * DevTools 名称（用于区分不同的应用实例）
     */
    name?: string;

    /**
     * 远程 DevTools 服务器配置
     */
    remote?: {
        /**
         * 远程服务器地址
         */
        hostname: string;

        /**
         * 远程服务器端口
         */
        port: number;

        /**
         * 是否使用安全连接
         */
        secure?: boolean;
    };

    /**
     * 是否在生产环境启用（默认 false）
     */
    trace?: boolean;

    /**
     * 最大 action 数量（默认 50）
     */
    maxAge?: number;
}

/**
 * 创建 DevTools Enhancer
 */
export const createDevToolsEnhancer = (options: DevToolsOptions) => {
    if (!options.enabled) {
        return undefined;
    }

    const devToolsOptions: any = {
        name: options.name || 'IMPos2 Desktop',
        trace: options.trace || false,
        maxAge: options.maxAge || 50,
    };

    // 如果配置了远程服务器，添加远程配置
    if (options.remote) {
        devToolsOptions.hostname = options.remote.hostname;
        devToolsOptions.port = options.remote.port;
        devToolsOptions.secure = options.remote.secure || false;
        devToolsOptions.realtime = true;
    }

    return composeWithDevTools(devToolsOptions);
};
