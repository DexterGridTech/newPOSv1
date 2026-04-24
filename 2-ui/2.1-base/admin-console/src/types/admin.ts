export type AdminConsoleScreen = 'login' | 'panel'

export type AdminConsoleGroup = 'runtime' | 'adapter'

export type AdminConsoleTab =
    | 'device'
    | 'connector'
    | 'logs'
    | 'topology'
    | 'control'
    | 'terminal'
    | 'adapter'

export interface AdminLauncherOptions {
    enabled: boolean
    requiredPresses?: number
    timeWindowMs?: number
    areaSize?: number
    onTriggered: () => void
}

export interface AdminPasswordVerifier {
    verify(password: string): boolean
    deriveFor(date: Date): string
}

export type AdapterDiagnosticStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped'

export interface AdapterDiagnosticResult {
    adapterKey: string
    scenarioKey: string
    title: string
    status: Exclude<AdapterDiagnosticStatus, 'idle' | 'running'>
    message: string
    detail?: Record<string, unknown>
    startedAt: number
    finishedAt: number
    durationMs: number
}

export interface AdapterDiagnosticScenario {
    adapterKey: string
    scenarioKey: string
    title: string
    description?: string
    run(): Promise<Omit<AdapterDiagnosticResult, 'adapterKey' | 'scenarioKey' | 'title' | 'startedAt' | 'finishedAt' | 'durationMs'>>
}

export interface AdapterDiagnosticsRegistry {
    getScenarios(): readonly AdapterDiagnosticScenario[]
    setScenarios(scenarios: readonly AdapterDiagnosticScenario[]): void
}

export interface AdapterDiagnosticSummary {
    runId: string
    status: Exclude<AdapterDiagnosticStatus, 'idle' | 'running'>
    total: number
    passed: number
    failed: number
    skipped: number
    startedAt: number
    finishedAt: number
    durationMs: number
    results: AdapterDiagnosticResult[]
}

export interface AdminConsoleState {
    selectedTab: AdminConsoleTab
    latestAdapterSummary?: AdapterDiagnosticSummary
}

export interface AdminDetailItem {
    key: string
    label: string
    value: string | number | boolean | null | undefined
}

export type AdminStatusTone = 'neutral' | 'ok' | 'warn' | 'error'

export interface AdminStatusItem {
    key: string
    label: string
    tone?: AdminStatusTone
    value?: string
    detail?: string
}

export interface AdminDeviceSnapshot {
    identity: readonly AdminDetailItem[]
    runtime: readonly AdminDetailItem[]
    peripherals?: readonly AdminStatusItem[]
    resourceDetails?: Readonly<{
        usbDevices?: readonly Record<string, unknown>[]
        bluetoothDevices?: readonly Record<string, unknown>[]
        serialDevices?: readonly Record<string, unknown>[]
        networks?: readonly Record<string, unknown>[]
        installedApps?: readonly Record<string, unknown>[]
    }>
}

export interface AdminDeviceHost {
    getSnapshot(): Promise<AdminDeviceSnapshot>
}

export interface AdminLogFileSummary {
    fileName: string
    fileSizeBytes?: number
    lastModifiedAt?: number
}

export interface AdminLogHost {
    listFiles(): Promise<readonly AdminLogFileSummary[]>
    readFile(fileName: string): Promise<string>
    deleteFile(fileName: string): Promise<void | boolean>
    clearAll(): Promise<void | boolean>
    getDirectoryPath(): Promise<string | undefined>
}

export interface AdminControlSnapshot {
    isFullScreen?: boolean
    isAppLocked?: boolean
    selectedSpace?: string
    availableSpaces?: readonly string[]
    supportsRestart?: boolean
    supportsClearCache?: boolean
    supportsLockControl?: boolean
    supportsFullScreenControl?: boolean
}

export interface AdminAppControlHost {
    getSnapshot(): Promise<AdminControlSnapshot>
    setFullScreen?(next: boolean): Promise<void>
    setAppLocked?(next: boolean): Promise<void>
    restartApp?(): Promise<void>
    clearCache?(): Promise<void>
}

export interface AdminConnectorChannelSnapshot {
    key: string
    title: string
    target?: string
    detail?: string
}

export interface AdminConnectorProbeResult {
    channelKey: string
    tone: AdminStatusTone
    message: string
}

export interface AdminConnectorHost {
    getChannels(): Promise<readonly AdminConnectorChannelSnapshot[]>
    probe(channelKey: string): Promise<AdminConnectorProbeResult>
}

export interface AdminTopologySharePayload {
    formatVersion: string
    deviceId: string
    masterNodeId: string
    exportedAt?: number
    serverAddress?: readonly {
        address: string
    }[]
    wsUrl?: string
    httpBaseUrl?: string
}

export interface AdminBarcodeScanTaskResult {
    barcode: string
    format?: string
    raw?: Record<string, unknown>
}

export interface AdminTopologyHost {
    getSharePayload?(): Promise<AdminTopologySharePayload | null>
    importSharePayload?(payload: AdminTopologySharePayload): Promise<void>
    clearMasterLocator?(): Promise<void>
    reconnect?(): Promise<void>
    stop?(): Promise<void>
    getTopologyHostStatus?(): Promise<Record<string, unknown> | null>
    getTopologyHostDiagnostics?(): Promise<Record<string, unknown> | null>
}

export interface AdminHostTools {
    device?: AdminDeviceHost
    logs?: AdminLogHost
    control?: AdminAppControlHost
    connector?: AdminConnectorHost
    topology?: AdminTopologyHost
}

export interface AdminHostToolsResolver {
    get(localNodeId: import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2['localNodeId']): Readonly<AdminHostTools>
    install(
        localNodeId: import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2['localNodeId'],
        hostTools: Partial<AdminHostTools>,
    ): void
    reset(localNodeId?: import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2['localNodeId']): void
}

export interface AdminConsoleSectionRenderContext {
    runtime: import('@next/kernel-base-runtime-shell-v2').KernelRuntimeV2
    store: import('@reduxjs/toolkit').EnhancedStore
    closePanel: () => void
    hostTools: Readonly<AdminHostTools>
}

export interface AdminConsoleSection {
    tab: AdminConsoleTab
    group?: AdminConsoleGroup
    title: string
    render(context: AdminConsoleSectionRenderContext): React.ReactNode
}

export interface AdminConsoleSectionRegistry {
    list(): readonly AdminConsoleSection[]
    replace(sections: readonly AdminConsoleSection[]): void
}
