import {createStateSyncMiddleware} from "./stateSyncMiddleware";

export const kernelCoreInterconnectionMiddlewares = {
    stateSyncMiddleware: {
        middleware: createStateSyncMiddleware(),
        priority: 100
    }
}