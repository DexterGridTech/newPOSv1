import {IPosAdapter} from "../types";

let nativeAdapter: IPosAdapter | null = null;
let workspace: string = 'unknownWorkspace';

export function setNativeAdapter(currentWorkspace: string, adapter: IPosAdapter): void {
    nativeAdapter = adapter;
    workspace = currentWorkspace
}

export const getNativeAdapter = (): IPosAdapter | null => {
    return nativeAdapter;
};
export const logger = {
    debug: (tags: string[], message: string, data?: any) => {
        const tag = `[${workspace}-${tags.join('.')}]`
        console.debug(tag, message, data)
        getNativeAdapter()?.logger.debug(tag, message, data)
    },
    log: (tags: string[], message: string, data?: any) => {
        const tag = `[${workspace}-${tags.join('.')}]`
        console.log(tag, message, data)
        getNativeAdapter()?.logger.log(tag, message, data)
    },
    warn: (tags: string[], message: string, data?: any) => {
        const tag = `[${workspace}-${tags.join('.')}]`
        console.warn(tag, message, data)
        getNativeAdapter()?.logger.warn(tag, message, data)
    },
    error: (tags: string[], message: string, data?: any) => {
        const tag = `[${workspace}-${tags.join('.')}]`
        console.error(tag, message, data)
        getNativeAdapter()?.logger.error(tag, message, data)
    },
}
export const storage = {
    setItem: <T>(nameSpace: string, key: string, value: T) => {
        getNativeAdapter()?.storage.setItem(nameSpace, key, value)
    },
    getItem: <T>(nameSpace: string, key: string) => {
        return getNativeAdapter()?.storage.getItem<T>(nameSpace, key)
    },
    getReduxStorage:()=>getNativeAdapter()?.storage.getStorage()
}
export const masterServer = {
    startServer: () => {
        return getNativeAdapter()?.localWebServer.startLocalWebServer() ?? Promise.resolve([
            {
                name: "address1",
                address: "http://localhost:8888/mockMasterServer",
            },
            {
                name: "address2",
                address: "http://localhost:9999/mockMasterServer",
            }
        ])
    }
}
export const deviceController = {
    getSystemStatus: () => {
        return getNativeAdapter()?.systemStatus.getSystemStatus()
    }
}
