/**
 * API 请求类
 * 封装单个 API 请求的执行和取消
 */
import axios from 'axios';
import { ApiManager } from './ApiManager';
import { moduleName } from '../../moduleName';
import { logger } from "../adapters/logger";
import { LOG_TAGS } from "../../types";
/**
 * API 类
 */
export class Api {
    _serverName;
    _path;
    _method;
    cancelTokenSource;
    constructor(serverName, path, method) {
        this._serverName = serverName;
        this._path = path;
        this._method = method;
    }
    serverName = () => this._serverName;
    path = () => this._path;
    async run(requestWrapper, timeout) {
        const apiManager = ApiManager.getInstance();
        // 调用 apiStart 回调
        // 创建取消令牌
        this.cancelTokenSource = axios.CancelToken.source();
        // 设置超时自动取消
        let timeoutId;
        if (timeout) {
            timeoutId = setTimeout(() => {
                this.cancel('Request timeout');
            }, timeout);
        }
        try {
            return await apiManager.runApi(this._serverName, this._path, this._method, requestWrapper, this.cancelTokenSource);
        }
        finally {
            // 确保清理资源
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            this.cancelTokenSource = undefined;
            logger.debug([moduleName, LOG_TAGS.Http, "Api"], this._serverName, apiManager.getMetrics());
        }
    }
    /**
     * 取消请求
     */
    cancel(reason) {
        if (this.cancelTokenSource) {
            this.cancelTokenSource.cancel(reason || 'Request cancelled by user');
        }
    }
}
