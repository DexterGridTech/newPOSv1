import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {
    StateRuntimeSliceDescriptor,
    SyncValueEnvelope,
} from '@impos2/kernel-base-state-runtime'
import {createSyncTombstone} from '@impos2/kernel-base-state-runtime'
import {TDP_HOT_UPDATE_STATE_KEY} from '../../foundations/stateKeys'
import {evaluateHotUpdateCompatibility} from '../../foundations/hotUpdateCompatibility'
import type {
    HotUpdateAppliedVersion,
    HotUpdateCurrentFacts,
    HotUpdateHistoryItem,
    HotUpdateRestartIntentState,
    HotUpdateState,
    TerminalHotUpdateDesiredV1,
} from '../../types'

const createInitialCurrentVersion = (): HotUpdateAppliedVersion => ({
    source: 'embedded',
    appId: 'assembly-android-mixc-retail-rn84',
    assemblyVersion: '1.0.0',
    buildNumber: 1,
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    bundleVersion: '1.0.0+ota.0',
    appliedAt: 0,
})

const initialState: HotUpdateState = {
    current: createInitialCurrentVersion(),
    history: [],
}

const appendHistory = (
    state: HotUpdateState,
    item: HotUpdateHistoryItem,
): HotUpdateHistoryItem[] => [
    ...state.history.slice(-49),
    item,
]

export const createTdpHotUpdateStateForTests = (
    overrides: Partial<HotUpdateState> = {},
): HotUpdateState => ({
    current: createInitialCurrentVersion(),
    history: [],
    ...overrides,
})

const deriveCurrentFactsFromState = (state: HotUpdateState): HotUpdateCurrentFacts => ({
    appId: state.current.appId,
    platform: state.current.appId.includes('electron') ? 'electron' : 'android',
    product: state.current.appId.includes('mixc-retail') ? 'mixc-retail' : 'unknown',
    runtimeVersion: state.current.runtimeVersion,
    assemblyVersion: state.current.assemblyVersion,
    buildNumber: state.current.buildNumber,
    channel: undefined,
    capabilities: [],
})

const createRestartIntent = (input: {
    desired: TerminalHotUpdateDesiredV1
    now: number
    idleThresholdMs?: number
    lastUserOperationAt?: number
}): HotUpdateRestartIntentState => {
    const mode = input.desired.restart.mode === 'idle' ? 'idle' : 'immediate'
    const idleThresholdMs = mode === 'idle'
        ? Math.max(
            1,
            input.desired.restart.idleWindowMs
            ?? input.idleThresholdMs
            ?? 300_000,
        )
        : undefined
    const nextEligibleAt = mode === 'idle' && idleThresholdMs != null
        ? (input.lastUserOperationAt ?? input.now) + idleThresholdMs
        : undefined

    return {
        releaseId: input.desired.releaseId,
        packageId: input.desired.packageId,
        bundleVersion: input.desired.bundleVersion,
        mode,
        status: mode === 'idle' ? 'waiting-idle' : 'pending',
        requestedAt: input.now,
        updatedAt: input.now,
        idleThresholdMs,
        lastUserOperationAt: input.lastUserOperationAt,
        nextEligibleAt,
    }
}

export const reduceHotUpdateDesired = (
    state: HotUpdateState,
    input: {
        desired?: TerminalHotUpdateDesiredV1
        currentFacts: HotUpdateCurrentFacts
        now: number
        idleThresholdMs?: number
    },
): HotUpdateState => {
    if (!input.desired) {
        if (!state.desired && !state.candidate && !state.ready) {
            return state
        }

        return {
            ...state,
            desired: undefined,
            candidate: undefined,
            ready: undefined,
            applying: undefined,
            restartIntent: undefined,
            history: appendHistory(state, {
                event: 'desired-cleared',
                releaseId: state.desired?.releaseId ?? state.candidate?.releaseId ?? state.ready?.releaseId,
                packageId: state.desired?.packageId ?? state.candidate?.packageId ?? state.ready?.packageId,
                bundleVersion: state.desired?.bundleVersion ?? state.candidate?.bundleVersion ?? state.ready?.bundleVersion,
                at: input.now,
            }),
        }
    }

    const desired = input.desired
    if (desired.rollout.mode === 'paused') {
        return {
            ...state,
            desired,
            candidate: undefined,
            restartIntent: undefined,
            history: appendHistory(state, {
                event: 'paused',
                releaseId: desired.releaseId,
                packageId: desired.packageId,
                bundleVersion: desired.bundleVersion,
                at: input.now,
            }),
        }
    }

    const compatibility = evaluateHotUpdateCompatibility({
        current: input.currentFacts,
        compatibility: desired.compatibility,
        desiredBundleVersion: desired.bundleVersion,
        currentBundleVersion: state.current.bundleVersion,
        rolloutMode: desired.rollout.mode,
        allowDowngrade: desired.rollout.allowDowngrade,
    })

    if (!compatibility.ok) {
        return {
            ...state,
            desired,
            candidate: {
                releaseId: desired.releaseId,
                packageId: desired.packageId,
                bundleVersion: desired.bundleVersion,
                status: 'compatibility-rejected',
                attempts: state.candidate?.packageId === desired.packageId ? state.candidate.attempts : 0,
                reason: compatibility.reason,
                packageUrl: desired.packageUrl,
                packageSha256: desired.packageSha256,
                manifestSha256: desired.manifestSha256,
                packageSize: desired.packageSize,
                updatedAt: input.now,
            },
            ready: undefined,
            applying: undefined,
            restartIntent: undefined,
            history: appendHistory(state, {
                event: 'compatibility-rejected',
                releaseId: desired.releaseId,
                packageId: desired.packageId,
                bundleVersion: desired.bundleVersion,
                reason: compatibility.reason,
                at: input.now,
            }),
        }
    }

    if (
        state.current.packageId === desired.packageId
        && state.current.bundleVersion === desired.bundleVersion
        && (
            state.current.source === 'hot-update'
            || state.current.source === 'rollback'
        )
    ) {
        return {
            ...state,
            desired,
            candidate: undefined,
            ready: undefined,
            applying: undefined,
            restartIntent: undefined,
        }
    }

    if (
        state.desired?.packageId === desired.packageId
        && state.candidate?.packageId === desired.packageId
    ) {
        return {
            ...state,
            desired,
        }
    }

    return {
        ...state,
        desired,
        candidate: {
            releaseId: desired.releaseId,
            packageId: desired.packageId,
            bundleVersion: desired.bundleVersion,
            status: 'download-pending',
            attempts: state.candidate?.packageId === desired.packageId ? state.candidate.attempts : 0,
            packageUrl: desired.packageUrl,
            packageSha256: desired.packageSha256,
            manifestSha256: desired.manifestSha256,
            packageSize: desired.packageSize,
            updatedAt: input.now,
        },
        history: appendHistory(state, {
            event: 'download-pending',
            releaseId: desired.releaseId,
            packageId: desired.packageId,
            bundleVersion: desired.bundleVersion,
            at: input.now,
        }),
    }
}

const hotUpdateSlice = createSlice({
    name: TDP_HOT_UPDATE_STATE_KEY,
    initialState,
    reducers: {
        reconcileDesired(state, action: PayloadAction<{
            desired?: TerminalHotUpdateDesiredV1
            currentFacts?: HotUpdateCurrentFacts
            now?: number
            idleThresholdMs?: number
        }>) {
            return reduceHotUpdateDesired(state, {
                desired: action.payload.desired,
                currentFacts: action.payload.currentFacts ?? deriveCurrentFactsFromState(state),
                now: action.payload.now ?? Date.now(),
                idleThresholdMs: action.payload.idleThresholdMs,
            })
        },
        markReady(state, action: PayloadAction<{
            releaseId: string
            packageId: string
            bundleVersion: string
            installDir: string
            entryFile?: string
            packageSha256: string
            manifestSha256: string
            readyAt?: number
        }>) {
            const readyAt = action.payload.readyAt ?? Date.now()
            state.ready = {
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                installDir: action.payload.installDir,
                packageSha256: action.payload.packageSha256,
                manifestSha256: action.payload.manifestSha256,
                entryFile: action.payload.entryFile,
                readyAt,
            }
            state.candidate = {
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                status: 'ready',
                attempts: state.candidate?.attempts ?? 0,
                packageSha256: action.payload.packageSha256,
                manifestSha256: action.payload.manifestSha256,
                updatedAt: readyAt,
            }
            state.history = appendHistory(state, {
                event: 'ready',
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                at: readyAt,
            })
        },
        markApplying(state, action: PayloadAction<{
            releaseId: string
            packageId: string
            bundleVersion: string
            bootMarkerPath?: string
            startedAt?: number
        }>) {
            const startedAt = action.payload.startedAt ?? Date.now()
            state.applying = {
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                bootMarkerPath: action.payload.bootMarkerPath,
                startedAt,
            }
            state.history = appendHistory(state, {
                event: 'applying',
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                at: startedAt,
            })
        },
        markRestartPending(state, action: PayloadAction<{
            desired: TerminalHotUpdateDesiredV1
            now?: number
            idleThresholdMs?: number
        }>) {
            const now = action.payload.now ?? Date.now()
            state.restartIntent = createRestartIntent({
                desired: action.payload.desired,
                now,
                idleThresholdMs: action.payload.idleThresholdMs,
                lastUserOperationAt: state.lastUserOperationAt,
            })
            state.history = appendHistory(state, {
                event: state.restartIntent.mode === 'idle'
                    ? 'restart-waiting-idle'
                    : 'restart-pending',
                releaseId: state.restartIntent.releaseId,
                packageId: state.restartIntent.packageId,
                bundleVersion: state.restartIntent.bundleVersion,
                at: now,
            })
        },
        updateRestartWaitingIdle(state, action: PayloadAction<{
            now?: number
            idleThresholdMs?: number
        }>) {
            if (!state.restartIntent || state.restartIntent.mode !== 'idle') {
                return
            }
            const now = action.payload.now ?? Date.now()
            const idleThresholdMs = Math.max(
                1,
                action.payload.idleThresholdMs
                ?? state.restartIntent.idleThresholdMs
                ?? 300_000,
            )
            state.restartIntent.status = 'waiting-idle'
            state.restartIntent.idleThresholdMs = idleThresholdMs
            state.restartIntent.updatedAt = now
            state.restartIntent.lastUserOperationAt = state.lastUserOperationAt
            state.restartIntent.nextEligibleAt = (state.lastUserOperationAt ?? now) + idleThresholdMs
        },
        markRestartPreparing(state, action: PayloadAction<{
            now?: number
        }>) {
            if (!state.restartIntent) {
                return
            }
            const now = action.payload.now ?? Date.now()
            state.restartIntent.status = 'preparing'
            state.restartIntent.updatedAt = now
            state.history = appendHistory(state, {
                event: 'restart-preparing',
                releaseId: state.restartIntent.releaseId,
                packageId: state.restartIntent.packageId,
                bundleVersion: state.restartIntent.bundleVersion,
                at: now,
            })
        },
        markRestartReady(state, action: PayloadAction<{
            now?: number
        }>) {
            if (!state.restartIntent) {
                return
            }
            const now = action.payload.now ?? Date.now()
            state.restartIntent.status = 'ready-to-restart'
            state.restartIntent.updatedAt = now
            state.history = appendHistory(state, {
                event: 'restart-ready',
                releaseId: state.restartIntent.releaseId,
                packageId: state.restartIntent.packageId,
                bundleVersion: state.restartIntent.bundleVersion,
                at: now,
            })
        },
        clearRestartIntent(state) {
            state.restartIntent = undefined
        },
        recordUserOperation(state, action: PayloadAction<{
            at?: number
        }>) {
            const at = action.payload.at ?? Date.now()
            state.lastUserOperationAt = at
            if (
                state.restartIntent?.mode === 'idle'
                && state.restartIntent.status !== 'preparing'
                && state.restartIntent.status !== 'ready-to-restart'
            ) {
                const idleThresholdMs = Math.max(1, state.restartIntent.idleThresholdMs ?? 300_000)
                const currentEligibleAt = state.restartIntent.nextEligibleAt
                    ?? (state.restartIntent.lastUserOperationAt ?? state.restartIntent.requestedAt) + idleThresholdMs

                if (at < currentEligibleAt) {
                    state.restartIntent.status = 'waiting-idle'
                    state.restartIntent.updatedAt = at
                    state.restartIntent.lastUserOperationAt = at
                    state.restartIntent.nextEligibleAt = at + idleThresholdMs
                }
            }
            state.history = appendHistory(state, {
                event: 'user-operation-recorded',
                at,
            })
        },
        markApplied(state, action: PayloadAction<{
            current: HotUpdateAppliedVersion
            previous?: HotUpdateAppliedVersion
            now?: number
        }>) {
            const timestamp = action.payload.now ?? Date.now()
            const sameCurrent =
                state.current.source === action.payload.current.source
                && state.current.bundleVersion === action.payload.current.bundleVersion
                && state.current.packageId === action.payload.current.packageId
                && state.current.releaseId === action.payload.current.releaseId
                && state.current.installDir === action.payload.current.installDir

            if (sameCurrent) {
                state.current = {
                    ...state.current,
                    ...action.payload.current,
                    appliedAt: action.payload.current.appliedAt ?? state.current.appliedAt,
                }
                state.candidate = undefined
                state.ready = undefined
                state.applying = undefined
                state.restartIntent = undefined
                return
            }

            state.previous = action.payload.previous ?? state.current
            state.current = action.payload.current
            state.candidate = undefined
            state.ready = undefined
            state.applying = undefined
            state.restartIntent = undefined
            state.history = appendHistory(state, {
                event: 'applied',
                releaseId: action.payload.current.releaseId,
                packageId: action.payload.current.packageId,
                bundleVersion: action.payload.current.bundleVersion,
                at: timestamp,
            })
        },
        markFailed(state, action: PayloadAction<{
            code: string
            message: string
            at?: number
        }>) {
            const at = action.payload.at ?? Date.now()
            state.lastError = {
                code: action.payload.code,
                message: action.payload.message,
                at,
            }
            if (state.candidate) {
                state.candidate.status = 'failed'
                state.candidate.reason = action.payload.code
                state.candidate.updatedAt = at
            }
            state.history = appendHistory(state, {
                event: 'download-failed',
                releaseId: state.candidate?.releaseId,
                packageId: state.candidate?.packageId,
                bundleVersion: state.candidate?.bundleVersion,
                reason: action.payload.code,
                at,
            })
        },
        markDownloadRetryPending(state, action: PayloadAction<{
            releaseId: string
            packageId: string
            bundleVersion: string
            at?: number
        }>) {
            const at = action.payload.at ?? Date.now()
            if (
                !state.desired
                || state.desired.packageId !== action.payload.packageId
                || state.candidate?.packageId !== action.payload.packageId
                || state.candidate.status !== 'failed'
            ) {
                return
            }
            state.candidate = {
                ...state.candidate,
                status: 'download-pending',
                reason: undefined,
                updatedAt: at,
            }
            state.history = appendHistory(state, {
                event: 'download-retry-pending',
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                at,
            })
        },
        markDownloading(state, action: PayloadAction<{
            releaseId: string
            packageId: string
            bundleVersion: string
            attempts: number
            at?: number
        }>) {
            const at = action.payload.at ?? Date.now()
            state.candidate = {
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                status: 'downloading',
                attempts: action.payload.attempts,
                packageUrl: state.desired?.packageUrl,
                packageSha256: state.desired?.packageSha256,
                manifestSha256: state.desired?.manifestSha256,
                packageSize: state.desired?.packageSize,
                updatedAt: at,
            }
            state.history = appendHistory(state, {
                event: 'download-started',
                releaseId: action.payload.releaseId,
                packageId: action.payload.packageId,
                bundleVersion: action.payload.bundleVersion,
                at,
            })
        },
        reportVersion(state, action: PayloadAction<{
            current: Partial<HotUpdateAppliedVersion>
            at?: number
        }>) {
            const at = action.payload.at ?? Date.now()
            state.current = {
                ...state.current,
                ...action.payload.current,
                appliedAt: action.payload.current.appliedAt ?? at,
            }
            state.history = appendHistory(state, {
                event: 'version-reported',
                releaseId: state.current.releaseId,
                packageId: state.current.packageId,
                bundleVersion: state.current.bundleVersion,
                at,
            })
        },
    },
})

export const tdpHotUpdateActions = hotUpdateSlice.actions

const syncDescriptor = {
    kind: 'record' as const,
    getEntries(state: HotUpdateState) {
        const currentUpdatedAt = state.current.appliedAt
        const desiredUpdatedAt = state.desired
            ? Date.parse(state.desired.rollout.publishedAt) || currentUpdatedAt
            : currentUpdatedAt

        return {
            desired: state.desired
                ? {value: state.desired, updatedAt: desiredUpdatedAt}
                : createSyncTombstone(desiredUpdatedAt),
        }
    },
    applyEntries(
        state: HotUpdateState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): HotUpdateState {
        return {
            ...state,
            desired: entries.desired?.tombstone
                ? undefined
                : (entries.desired?.value as HotUpdateState['desired'] | undefined) ?? state.desired,
        }
    },
}

export const tdpHotUpdateSliceDescriptor: StateRuntimeSliceDescriptor<HotUpdateState> = {
    name: TDP_HOT_UPDATE_STATE_KEY,
    reducer: hotUpdateSlice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'current', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'desired', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'candidate', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'ready', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'applying', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'restartIntent', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastUserOperationAt', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'previous', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'history', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastError', flushMode: 'immediate'},
    ],
    sync: syncDescriptor as any,
}
