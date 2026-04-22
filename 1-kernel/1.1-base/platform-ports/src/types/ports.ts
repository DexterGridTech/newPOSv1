import type {LoggerPort, LogEnvironmentMode} from './logging'

export interface ScriptExecutorPort {
    execute<T = unknown>(input: {
        source: string
        params?: Record<string, unknown>
        globals?: Record<string, unknown>
        nativeFunctions?: Record<string, (...args: any[]) => unknown>
        timeoutMs?: number
    }): Promise<T>
}

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
    addPowerStatusChangeListener?(
        listener: (event: Record<string, unknown>) => void,
    ): () => void
}

export interface AppControlPort {
    restartApp(): Promise<void>
    clearDataCache?(): Promise<void>
}

export interface TopologyHostAddressInfo {
    httpBaseUrl?: string
    wsUrl?: string
    localHttpBaseUrl?: string
    localWsUrl?: string
}

export interface TopologyHostStatus {
    state?: string
    addressInfo?: TopologyHostAddressInfo | null
    [key: string]: unknown
}

export interface TopologyHostPort {
    start(config?: Record<string, unknown>): Promise<TopologyHostAddressInfo | Record<string, unknown>>
    stop(): Promise<void>
    getStatus?(): Promise<TopologyHostStatus | Record<string, unknown> | null>
    getDiagnosticsSnapshot?(): Promise<Record<string, unknown> | null>
}

export interface HotUpdatePort {
    downloadPackage(input: {
        packageId: string
        releaseId: string
        bundleVersion: string
        packageUrls: readonly string[]
        packageSha256: string
        manifestSha256: string
        packageSize: number
    }): Promise<{
        installDir: string
        entryFile: string
        manifestPath: string
        packageSha256: string
        manifestSha256: string
    }>
    writeBootMarker(input: {
        releaseId: string
        packageId: string
        bundleVersion: string
        installDir: string
        entryFile?: string
        manifestSha256: string
        maxLaunchFailures: number
        healthCheckTimeoutMs?: number
    }): Promise<{bootMarkerPath: string}>
    readBootMarker?(): Promise<Record<string, unknown> | null>
    readActiveMarker?(): Promise<Record<string, unknown> | null>
    readRollbackMarker?(): Promise<Record<string, unknown> | null>
    clearBootMarker?(): Promise<void>
    confirmLoadComplete?(input?: {
        displayIndex?: number
        releaseId?: string
        packageId?: string
        bundleVersion?: string
    }): Promise<Record<string, unknown> | null>
    reportLoadComplete?(input: {
        displayIndex: number
        releaseId?: string
        packageId?: string
        bundleVersion?: string
    }): Promise<void>
}

export interface LocalWebServerPort {
    start(config?: Record<string, unknown>): Promise<Record<string, unknown>>
    stop?(): Promise<void>
    getStatus?(): Promise<Record<string, unknown>>
}

export interface ConnectorPort {
    call?(input: {
        channel: Record<string, unknown>
        action: string
        params?: Record<string, unknown>
        timeoutMs?: number
    }): Promise<Record<string, unknown>>
    subscribe?(input: {
        channel: Record<string, unknown>
        onMessage: (message: Record<string, unknown>) => void
        onError?: (error: Record<string, unknown>) => void
    }): Promise<string>
    unsubscribe?(subscriptionId: string): Promise<void>
    on?(
        eventType: string,
        handler: (event: Record<string, unknown>) => void,
    ): () => void
    isAvailable?(channel: Record<string, unknown>): Promise<boolean>
    getAvailableTargets?(type: string): Promise<readonly string[]>
    connect?(input: Record<string, unknown>): Promise<Record<string, unknown>>
    disconnect?(input?: Record<string, unknown>): Promise<void>
}

export interface PlatformPorts {
    environmentMode: LogEnvironmentMode
    logger: LoggerPort
    scriptExecutor?: ScriptExecutorPort
    stateStorage?: StateStoragePort
    secureStateStorage?: StateStoragePort
    device?: DevicePort
    appControl?: AppControlPort
    hotUpdate?: HotUpdatePort
    topologyHost?: TopologyHostPort
    localWebServer?: LocalWebServerPort
    connector?: ConnectorPort
}

export interface CreatePlatformPortsInput extends PlatformPorts {}
