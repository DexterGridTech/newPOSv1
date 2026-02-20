/**
 * API 请求类
 * 封装单个 API 请求的执行和取消
 */

import axios, {CancelTokenSource} from 'axios';
import {ApiManager} from './ApiManager';
import {HttpMethod, RequestWrapper, ResponseWrapper} from '../../types/shared/http';
import { moduleName } from '../../moduleName';
import {logger} from "../logger";
import {LOG_TAGS} from "../../types";

/**
 * API 类
 */
export class Api<T, R> {
    private readonly _serverName: string;
    private readonly _path: string;
    private readonly _method: HttpMethod;
    private cancelTokenSource?: CancelTokenSource;

    constructor(serverName: string, path: string, method: HttpMethod) {
        this._serverName = serverName;
        this._path = path;
        this._method = method;
    }

    serverName = () => this._serverName
    path = () => this._path

    async run(requestWrapper: RequestWrapper<T>, timeout?: number): Promise<ResponseWrapper<R>> {
        const apiManager = ApiManager.getInstance();
        // 调用 apiStart 回调

        // 创建取消令牌
        this.cancelTokenSource = axios.CancelToken.source();

        // 设置超时自动取消
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (timeout) {
            timeoutId = setTimeout(() => {
                this.cancel('Request timeout');
            }, timeout);
        }

        try {
            return await apiManager.runApi<T, R>(
                this._serverName,
                this._path,
                this._method,
                requestWrapper,
                this.cancelTokenSource
            );
        } finally {
            // 确保清理资源
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            this.cancelTokenSource = undefined;
            logger.debug([moduleName, LOG_TAGS.Http, "Api"], this._serverName, apiManager.getMetrics())
        }
    }

    /**
     * 取消请求
     */
    cancel(reason?: string): void {
        if (this.cancelTokenSource) {
            this.cancelTokenSource.cancel(reason || 'Request cancelled by user');
        }
    }
}
