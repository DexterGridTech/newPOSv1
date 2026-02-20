import {ServerAddress, SystemStatus} from "./base";


//即将废弃，不要引用这个类
export interface INativeAdapter {

    debug(...args: any[]): void;

    log(...args: any[]): void;

    warn(...args: any[]): void;

    error(...args: any[]): void;

    sendLogFileToServer(fileDate: string, apiPath: string, serverAddresses: ServerAddress[]): Promise<void>;

    persistStatePropertyValue(stateKey: string, propertyKey: string, propertyValue: any): Promise<void>;

    getPersistedState(): Promise<any>;

    startServer(): Promise<ServerAddress[]>;

    getSystemStatus(): Promise<SystemStatus>;

    getCurrentAppVersion(): Promise<string>;

    getCurrentAssemblyVersion(): Promise<string>;

    downloadAssemblyVersion(version: string, apiPath: string, serverAddresses: ServerAddress[]): Promise<void>;

    switchToAssemblyVersion(version: string): Promise<void>;
}