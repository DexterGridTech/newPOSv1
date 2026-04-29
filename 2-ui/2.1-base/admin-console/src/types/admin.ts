export type AdminConsoleScreen = 'login' | 'panel'

export type AdminConsoleGroup = 'runtime' | 'adapter'

export type AdminConsoleTab =
    | 'device'
    | 'connector'
    | 'logs'
    | 'tdp'
    | 'topology'
    | 'version'
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

export interface AdminVersionNativeMarkers {
    boot?: Record<string, unknown> | null
    active?: Record<string, unknown> | null
    rollback?: Record<string, unknown> | null
}

export interface AdminVersionSnapshot {
    embeddedRelease?: readonly AdminDetailItem[]
    nativeMarkers?: AdminVersionNativeMarkers
    capabilities?: readonly AdminStatusItem[]
}

export interface AdminVersionHost {
    getSnapshot(): Promise<AdminVersionSnapshot>
    clearBootMarker?(): Promise<void>
}

export interface AdminTdpServerOperationsSnapshot {
    mode?: 'server-enhanced' | string
    sampledAt?: number
    terminal?: {
        terminalId?: string
        sandboxId?: string
        profileId?: string
        profileCode?: string
        profileName?: string
        templateId?: string
        templateCode?: string
        templateName?: string
        presenceStatus?: string
        healthStatus?: string
        currentAppVersion?: string | null
        currentBundleVersion?: string | null
        currentConfigVersion?: string | null
        lastSeenAt?: number | null
    }
    topicRegistry?: {
        total?: number
        topics?: readonly {
            key: string
            name?: string
            payloadMode?: string
            scopeType?: string
            lifecycle?: string
            deliveryType?: string
        }[]
    }
    policy?: {
        allowedTopics?: readonly string[]
        policySources?: readonly string[]
    }
    resolvedTopics?: {
        availableTopics?: readonly string[]
        resolvedItemCounts?: Record<string, number>
    }
    sessions?: {
        total?: number
        currentSessionId?: string
        onlineSessions?: readonly Record<string, unknown>[]
        current?: {
            sessionId?: string
            status?: string
            highWatermark?: number
            ackLag?: number
            applyLag?: number
            connectedAt?: number
            lastHeartbeatAt?: number
            subscription?: {
                mode?: string
                hash?: string
                subscribedTopics?: readonly string[]
                acceptedTopics?: readonly string[]
                rejectedTopics?: readonly string[]
                requiredMissingTopics?: readonly string[]
            }
        }
    }
    subscription?: {
        requestedTopics?: readonly string[]
        acceptedTopics?: readonly string[]
        rejectedTopics?: readonly string[]
        requiredMissingTopics?: readonly string[]
        acceptedHash?: string
        serverAvailableTopics?: readonly string[]
    }
    decisionTrace?: {
        runtimeFacts?: Record<string, unknown>
        membershipSnapshot?: Record<string, unknown>
        topics?: readonly {
            topicKey: string
            itemKey: string
            candidateCount: number
            winner?: {
                scopeType?: string
                scopeKey?: string
                revision?: number
                source?: string
                policyId?: string
                reason?: string
            } | null
        }[]
    }
    findings?: readonly {
        key: string
        tone: AdminStatusTone
        title: string
        detail: string
    }[]
}

export interface AdminTdpHost {
    getOperationsSnapshot(input: {
        sandboxId: string
        terminalId: string
    }): Promise<AdminTdpServerOperationsSnapshot>
}

export interface AdminHostTools {
    device?: AdminDeviceHost
    logs?: AdminLogHost
    control?: AdminAppControlHost
    connector?: AdminConnectorHost
    topology?: AdminTopologyHost
    version?: AdminVersionHost
    tdp?: AdminTdpHost
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
