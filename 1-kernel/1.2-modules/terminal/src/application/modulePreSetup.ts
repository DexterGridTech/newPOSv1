import {ApiManager, ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base";
import {InternalAxiosRequestConfig} from "axios";
import {kernelTokenGetter} from "../foundations/kernelServer";
import {SERVER_NAME_KERNEL_API} from "../foundations";


export const kernelTerminalModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    initLogger.logNames([`ApiManager add requestInterceptor for ${SERVER_NAME_KERNEL_API}`])
    ApiManager.getInstance().addRequestInterceptor({
        serverName: SERVER_NAME_KERNEL_API,
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
    });
}