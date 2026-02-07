import {RequestInterceptor, ResponseInterceptor} from "../../types";
import {InternalAxiosRequestConfig} from "axios";
import {ApiManager, logger} from "../../core";
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../types';

export const KERNEL_API_SERVER_NAME = "kernelApi";
export const KERNEL_WS_SERVER_NAME = "kernelWS";

export const kernelTokenGetter={
    get:(): string | null | undefined =>{
        return null
    }
}

const logRequestInterceptor: RequestInterceptor = {
    onRequest: (config: InternalAxiosRequestConfig) => {
        if (config.headers) {
            config.headers['Content-Type'] = `application/json`;
        }
        logger.log([moduleName, LOG_TAGS.System, "kernelServer"], '[请求拦截器] 发送请求:', config.url);
        return config;
    },
    onRequestError: (error) => {
        logger.error([moduleName, LOG_TAGS.System, "kernelServer"], '[请求拦截器] 请求错误:', error);
        return Promise.reject(error);
    }
};

const logResponseInterceptor: ResponseInterceptor = {
    onResponse: (response) => {
        logger.log([moduleName, LOG_TAGS.System, "kernelServer"], '[响应拦截器] 收到响应:', response.status);
        return response;
    },
    onResponseError: (error) => {
        logger.error([moduleName, LOG_TAGS.System, "kernelServer"], '[响应拦截器] 响应错误:', error.message);
        return Promise.reject(error);
    }
};
const kernelTokenRequestInterceptor: RequestInterceptor = {
    serverName: KERNEL_API_SERVER_NAME,
    onRequest: (config: InternalAxiosRequestConfig) => {
        const token = kernelTokenGetter.get()
        if (token && config.headers) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    onRequestError: (error) => {
        return Promise.reject(error);
    }
};


ApiManager.getInstance().addRequestInterceptor(logRequestInterceptor);
ApiManager.getInstance().addResponseInterceptor(logResponseInterceptor);
ApiManager.getInstance().addRequestInterceptor(kernelTokenRequestInterceptor);

