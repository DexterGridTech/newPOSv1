import {createStateSyncMiddleware} from "./stateSyncMiddleware";

export const kernelCoreInterconnectionMiddlewares = {
    stateSyncMiddleware: createStateSyncMiddleware()
}