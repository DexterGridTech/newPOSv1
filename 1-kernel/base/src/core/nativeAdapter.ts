import {IPosAdapter, Workspace} from "../types";

let nativeAdapter: IPosAdapter | null = null;
let currentWorkspace: string = 'unknownWorkspace';

export function setNativeAdapter(selectedWorkspace: string, adapter: IPosAdapter): void {
    nativeAdapter = adapter;
    currentWorkspace = selectedWorkspace
}

export const getNativeAdapter = (): IPosAdapter | null => {
    return nativeAdapter;
};
export const logger = {
    debug: (tags: string[], message: string, data?: any) => {
        const tag = `[${currentWorkspace}-${tags.join('.')}]`
        console.debug(tag, message, data)
        getNativeAdapter()?.logger.debug(tag, message, data)
    },
    log: (tags: string[], message: string, data?: any) => {
        const tag = `[${currentWorkspace}-${tags.join('.')}]`
        console.log(tag, message, data)
        getNativeAdapter()?.logger.log(tag, message, data)
    },
    warn: (tags: string[], message: string, data?: any) => {
        const tag = `[${currentWorkspace}-${tags.join('.')}]`
        console.warn(tag, message, data)
        getNativeAdapter()?.logger.warn(tag, message, data)
    },
    error: (tags: string[], message: string, data?: any) => {
        const tag = `[${currentWorkspace}-${tags.join('.')}]`
        console.error(tag, message, data)
        getNativeAdapter()?.logger.error(tag, message, data)
    },
}
export const storage = {
    getReduxStorage: () => getNativeAdapter()?.storage.getStorage(),
    setItem: async <T>(nameSpace: string, key: string, value: T) => {
        await getNativeAdapter()?.storage.setItem(nameSpace, key, value)
    },
    getItem: async <T>(nameSpace: string, key: string) => {
        return getNativeAdapter()?.storage.getItem<T>(nameSpace, key)
    },
    setToNextDataVersion: async () => {
        const currentVersion = await getNativeAdapter()?.storage.getItem<number>(currentWorkspace, 'dataVersion') ?? 0
        const nextVersion = currentVersion + 1
        await getNativeAdapter()?.storage.setItem(currentWorkspace, 'dataVersion', nextVersion)
    },
    getDataVersion: async () => {
        return await getNativeAdapter()?.storage.getItem<number>(currentWorkspace, 'dataVersion') ?? 0
    },
    getWorkspace: async () => {
        return getNativeAdapter()?.storage.getItem<Workspace>("global", 'workspace');
    },
    setWorkspace: async (workspace: Workspace) => {
        await getNativeAdapter()?.storage.setItem("global", 'workspace', workspace)
    }
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
