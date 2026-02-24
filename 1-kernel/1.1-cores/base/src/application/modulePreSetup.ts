import {ApplicationConfig, AppModule} from "./types";
import {LOG_TAGS} from "../types";
import {InternalAxiosRequestConfig} from "axios";
import {ApiManager, logger} from "../foundations";
import {moduleName} from "../moduleName";
import {InitLogger} from "./initLogger";

export const kernelCoreBaseModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    initLogger.logNames(['ApiManager add requestInterceptor & responseInterceptor'])
    ApiManager.getInstance().addRequestInterceptor({
        onRequest: (config: InternalAxiosRequestConfig) => {
            if (config.headers) {
                config.headers['Content-Type'] = `application/json`;
            }
            logger.log([moduleName, LOG_TAGS.System, "kernelServer"], `[请求拦截器] 发送请求:${config.baseURL}${config.url}`, config.data);
            return config;
        },
        onRequestError: (error) => {
            logger.error([moduleName, LOG_TAGS.System, "kernelServer"], '[请求拦截器] 请求错误:', error);
            return Promise.reject(error);
        }
    });
    ApiManager.getInstance().addResponseInterceptor({
        onResponse: (response) => {
            logger.log([moduleName, LOG_TAGS.System, "kernelServer"], `[响应拦截器] 收到响应:${response.request.url} status:${response.status} data:`,response.data);
            return response;
        },
        onResponseError: (error) => {
            logger.error([moduleName, LOG_TAGS.System, "kernelServer"], '[响应拦截器] 响应错误:', error.message);
            return Promise.reject(error);
        }
    });
}