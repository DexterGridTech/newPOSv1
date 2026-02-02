import {INativeAdapter, ServerAddress, SystemStatus} from "../types";

const defaultNativeAdapter: INativeAdapter = {
    workspace: 'defaultWS',
    log(...args: any[]) {
        console.log(`[${this.workspace}][log]`, ...args)
    },
    warn(...args: any[]) {
        console.warn(`[${this.workspace}][warn]`, ...args)
    },
    debug(...args: any[]) {
        console.debug(`[${this.workspace}][debug]`, ...args)
    },
    error(...args: any[]) {
        console.error(`[${this.workspace}][error]`, ...args)
    },
    sendLogFileToServer(fileDate: string, apiPath: string, serverAddresses: ServerAddress[]): Promise<void> {
        console.log(`[${this.workspace}][sendLogFileToServer]`, fileDate, apiPath, serverAddresses)
        return Promise.resolve()
    },
    persistStatePropertyValue(stateKey: string, propertyKey: string, propertyValue: any): Promise<void> {
        console.log(`[${this.workspace}][persistStatePropertyValue]`, stateKey, propertyKey, propertyValue)
        return Promise.resolve()
    },
    getPersistedState(): Promise<any> {
        console.log(`[${this.workspace}][getPersistedState]`)
        return Promise.resolve(null)
    },
    startServer(): Promise<ServerAddress[]> {
        console.log(`[start master server]`)
        return Promise.resolve([
            {
                name: "address1",
                address: "http://localhost:8888/mockMasterServer",
            },
            {
                name: "address2",
                address: "http://localhost:9999/mockMasterServer",
            }
        ])
    },
    getSystemStatus(): Promise<SystemStatus> {
        return Promise.resolve({
            cpu: {
                usage: Math.random() + '',
                temperature: Math.random() + '',
                frequency: Math.random() + ''
            },
            power: {
                status: 'charging',
                connect: 'on',
            }
        })
    },
    getCurrentAppVersion(): Promise<string> {
        return Promise.resolve('1.0.0')

    },
    getCurrentAssemblyVersion(): Promise<string> {
        return Promise.resolve('1.0.0')
    },
    downloadAssemblyVersion(version: string, apiPath: string, serverAddresses: ServerAddress[]): Promise<void> {
        console.log('[downloadAssemblyVersion]', version, apiPath, serverAddresses)
        return Promise.resolve()
    },
    switchToAssemblyVersion(version: string): Promise<void> {
        console.log('[switchToAssemblyVersion]', version)
        return Promise.resolve()
    }
}


let nativeAdapter: INativeAdapter = defaultNativeAdapter;

export function setNativeAdapter(adapter: INativeAdapter): void {
    nativeAdapter = adapter;
}

export const getNativeAdapter = (): INativeAdapter => {
    return nativeAdapter;
};
export const logger = {
    log: (...args: any[]) => getNativeAdapter().log(...args),
    warn: (...args: any[]) => getNativeAdapter().warn(...args),
    debug: (...args: any[]) => getNativeAdapter().debug(...args),
    error: (...args: any[]) => getNativeAdapter().error(...args),
    sendLogFileToServer: (fileDate: string, apiPath: string, serverAddresses: ServerAddress[]) => getNativeAdapter().sendLogFileToServer(fileDate, apiPath, serverAddresses),
}
export const storage = {
    persistStatePropertyValue: (stateKey: string, propertyKey: string, propertyValue: any) => getNativeAdapter().persistStatePropertyValue(stateKey, propertyKey, propertyValue),
    getPersistedState: () => getNativeAdapter().getPersistedState(),
}
export const masterServer = {
    startServer: () => getNativeAdapter().startServer(),
}
export const deviceController = {
    getSystemStatus: () => getNativeAdapter().getSystemStatus(),
    getCurrentAppVersion: () => getNativeAdapter().getCurrentAppVersion(),
    getCurrentAssemblyVersion: () => getNativeAdapter().getCurrentAssemblyVersion(),
    downloadAssemblyVersion: (version: string, apiPath: string, serverAddresses: ServerAddress[]) => getNativeAdapter().downloadAssemblyVersion(version, apiPath, serverAddresses),
    switchToAssemblyVersion: (version: string) => getNativeAdapter().switchToAssemblyVersion(version),
}
