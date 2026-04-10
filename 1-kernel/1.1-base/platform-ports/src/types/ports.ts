import type {LoggerPort, LogEnvironmentMode} from './logging'

export interface StateStoragePort {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
    multiGet?(keys: readonly string[]): Promise<Record<string, string | null>>
    multiSet?(entries: Readonly<Record<string, string>>): Promise<void>
    multiRemove?(keys: readonly string[]): Promise<void>
    getAllKeys?(): Promise<string[]>
    clear?(): Promise<void>
}

export interface DevicePort {
    getDeviceId(): Promise<string>
    getPlatform(): Promise<string>
    getModel?(): Promise<string>
}

export interface AppControlPort {
    restartApp(): Promise<void>
    clearDataCache?(): Promise<void>
    switchServerSpace?(serverSpace: string): Promise<void>
}

export interface LocalWebServerPort {
    start(config?: Record<string, unknown>): Promise<Record<string, unknown>>
    stop?(): Promise<void>
    getStatus?(): Promise<Record<string, unknown>>
}

export interface ConnectorPort {
    connect(input: Record<string, unknown>): Promise<Record<string, unknown>>
    disconnect?(input?: Record<string, unknown>): Promise<void>
}

export interface PlatformPorts {
    environmentMode: LogEnvironmentMode
    logger: LoggerPort
    stateStorage?: StateStoragePort
    secureStateStorage?: StateStoragePort
    device?: DevicePort
    appControl?: AppControlPort
    localWebServer?: LocalWebServerPort
    connector?: ConnectorPort
}

export interface CreatePlatformPortsInput extends PlatformPorts {}
