export interface HotUpdateCompatibility {
    appId: string
    platform: 'android' | 'electron'
    product: string
    runtimeVersion: string
    minAssemblyVersion?: string
    maxAssemblyVersion?: string
    minBuildNumber?: number
    maxBuildNumber?: number
    allowedChannels?: string[]
    requiredCapabilities?: string[]
    forbiddenCapabilities?: string[]
    targetPackages?: Record<string, string>
}

export interface TerminalHotUpdateDesiredV1 {
    schemaVersion: 1
    releaseId: string
    packageId: string
    appId: string
    platform: 'android' | 'electron'
    product: string
    bundleVersion: string
    runtimeVersion: string
    packageUrl: string
    packageSize: number
    packageSha256: string
    manifestSha256: string
    compatibility: HotUpdateCompatibility
    restart: {
        mode: 'immediate' | 'idle' | 'next-launch' | 'manual'
        graceMs?: number
        idleWindowMs?: number
        deadlineAt?: string
        operatorInstruction?: string
    }
    rollout: {
        mode: 'active' | 'paused' | 'rollback'
        publishedAt: string
        expiresAt?: string
        allowDowngrade?: boolean
    }
    safety: {
        requireSignature: boolean
        maxDownloadAttempts: number
        maxLaunchFailures: number
        healthCheckTimeoutMs: number
    }
    metadata?: {
        releaseNotes?: string[]
        operator?: string
        reason?: string
    }
}

export interface HotUpdateCurrentFacts {
    appId: string
    platform: 'android' | 'electron'
    product: string
    runtimeVersion: string
    assemblyVersion: string
    buildNumber: number
    channel?: string
    capabilities: string[]
}

export type HotUpdateCandidateStatus =
    | 'desired-received'
    | 'compatibility-rejected'
    | 'download-pending'
    | 'downloading'
    | 'ready'
    | 'failed'

export interface HotUpdateCandidateState {
    releaseId: string
    packageId: string
    bundleVersion: string
    status: HotUpdateCandidateStatus
    attempts: number
    reason?: string
    packageUrl?: string
    packageSha256?: string
    manifestSha256?: string
    packageSize?: number
    updatedAt: number
}

export interface HotUpdateReadyState {
    releaseId: string
    packageId: string
    bundleVersion: string
    installDir: string
    entryFile?: string
    packageSha256: string
    manifestSha256: string
    readyAt: number
}

export interface HotUpdateApplyingState {
    releaseId: string
    packageId: string
    bundleVersion: string
    bootMarkerPath?: string
    startedAt: number
}

export interface HotUpdateRestartIntentState {
    releaseId: string
    packageId: string
    bundleVersion: string
    mode: 'immediate' | 'idle'
    status: 'pending' | 'waiting-idle' | 'preparing' | 'ready-to-restart'
    requestedAt: number
    updatedAt: number
    idleThresholdMs?: number
    lastUserOperationAt?: number
    nextEligibleAt?: number
}

export interface HotUpdateAppliedVersion {
    source: 'embedded' | 'hot-update' | 'rollback'
    appId: string
    assemblyVersion: string
    buildNumber: number
    runtimeVersion: string
    bundleVersion: string
    packageId?: string
    releaseId?: string
    installDir?: string
    appliedAt: number
}

export interface HotUpdateHistoryItem {
    event:
        | 'desired-received'
        | 'compatibility-rejected'
        | 'download-pending'
        | 'download-started'
        | 'download-failed'
        | 'ready'
        | 'applying'
        | 'applied'
        | 'desired-cleared'
        | 'paused'
        | 'rollback'
        | 'package-pruned'
        | 'version-reported'
        | 'restart-pending'
        | 'restart-waiting-idle'
        | 'restart-preparing'
        | 'restart-ready'
        | 'user-operation-recorded'
    releaseId?: string
    packageId?: string
    bundleVersion?: string
    reason?: string
    at: number
}

export interface HotUpdateState {
    current: HotUpdateAppliedVersion
    desired?: TerminalHotUpdateDesiredV1
    candidate?: HotUpdateCandidateState
    ready?: HotUpdateReadyState
    applying?: HotUpdateApplyingState
    restartIntent?: HotUpdateRestartIntentState
    lastUserOperationAt?: number
    previous?: HotUpdateAppliedVersion
    history: HotUpdateHistoryItem[]
    lastError?: {code: string; message: string; at: number}
}

export type HotUpdateCompatibilityResult =
    | {ok: true}
    | {ok: false; reason: string}
