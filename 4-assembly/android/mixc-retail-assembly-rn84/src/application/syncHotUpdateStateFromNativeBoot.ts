import type {
    KernelRuntimeV2,
    RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    selectTdpHotUpdateCurrent,
    tdpHotUpdateActions,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {releaseInfo} from '../generated/releaseInfo'
import {nativeHotUpdate} from '../turbomodules/hotUpdate'

export interface ReportAppLoadCompleteResult {
    terminalState: 'RUNNING' | 'ROLLED_BACK'
    reason?: string
}

type HotUpdateStateSyncRuntime = Pick<KernelRuntimeV2, 'getState' | 'getStore'>
    | Pick<RuntimeModuleContextV2, 'getState' | 'getStore'>

const createEmbeddedReleaseCurrent = (appliedAt: number) => ({
    source: 'embedded' as const,
    appId: releaseInfo.appId,
    assemblyVersion: releaseInfo.assemblyVersion,
    buildNumber: releaseInfo.buildNumber,
    runtimeVersion: releaseInfo.runtimeVersion,
    bundleVersion: releaseInfo.bundleVersion,
    appliedAt,
})

const shouldSyncEmbeddedReleaseCurrent = (
    current: ReturnType<typeof selectTdpHotUpdateCurrent>,
): boolean => {
    return (
        current?.source !== 'embedded'
        || current.appId !== releaseInfo.appId
        || current.assemblyVersion !== releaseInfo.assemblyVersion
        || current.buildNumber !== releaseInfo.buildNumber
        || current.runtimeVersion !== releaseInfo.runtimeVersion
        || current.bundleVersion !== releaseInfo.bundleVersion
    )
}

export const syncHotUpdateStateFromNativeBoot = async (
    runtime: HotUpdateStateSyncRuntime,
    options: {
        initializeEmbeddedCurrent?: boolean
        previousState?: RootState
    } = {},
): Promise<ReportAppLoadCompleteResult | null> => {
    const initializeEmbeddedCurrent = options.initializeEmbeddedCurrent ?? true
    const now = Date.now()
    const rollbackMarker = await nativeHotUpdate.readRollbackMarker().catch(() => null)
    if (rollbackMarker?.rollbackReason) {
        const previous = selectTdpHotUpdateCurrent(runtime.getState())
        runtime.getStore().dispatch(tdpHotUpdateActions.markApplied({
            previous,
            current: {
                source: 'rollback',
                appId: releaseInfo.appId,
                assemblyVersion: releaseInfo.assemblyVersion,
                buildNumber: releaseInfo.buildNumber,
                runtimeVersion: releaseInfo.runtimeVersion,
                bundleVersion: releaseInfo.bundleVersion,
                appliedAt: now,
            },
            now,
        }))
        runtime.getStore().dispatch(tdpHotUpdateActions.markFailed({
            code: String(rollbackMarker.rollbackReason),
            message: `Hot update rolled back: ${String(rollbackMarker.rollbackReason)}`,
        }))
        return {
            terminalState: 'ROLLED_BACK',
            reason: String(rollbackMarker.rollbackReason),
        }
    }

    const activeMarker = await nativeHotUpdate.readActiveMarker().catch(() => null)
    if (activeMarker?.bundleVersion && activeMarker.installDir) {
        const previous = selectTdpHotUpdateCurrent(runtime.getState())
        runtime.getStore().dispatch(tdpHotUpdateActions.markApplied({
            previous,
            current: {
                source: 'hot-update',
                appId: releaseInfo.appId,
                assemblyVersion: releaseInfo.assemblyVersion,
                buildNumber: releaseInfo.buildNumber,
                runtimeVersion: releaseInfo.runtimeVersion,
                bundleVersion: String(activeMarker.bundleVersion),
                packageId: typeof activeMarker.packageId === 'string' ? activeMarker.packageId : undefined,
                releaseId: typeof activeMarker.releaseId === 'string' ? activeMarker.releaseId : undefined,
                installDir: String(activeMarker.installDir),
                appliedAt: now,
            },
        }))
        return null
    }

    if (!initializeEmbeddedCurrent) {
        const previousCurrent = options.previousState
            ? selectTdpHotUpdateCurrent(options.previousState)
            : undefined
        const current = selectTdpHotUpdateCurrent(runtime.getState())
        if (
            previousCurrent
            && (
                previousCurrent.source === 'hot-update'
                || previousCurrent.source === 'rollback'
            )
            && (
                current?.source !== previousCurrent.source
                || current.bundleVersion !== previousCurrent.bundleVersion
                || current.packageId !== previousCurrent.packageId
                || current.releaseId !== previousCurrent.releaseId
                || current.installDir !== previousCurrent.installDir
            )
        ) {
            runtime.getStore().dispatch(tdpHotUpdateActions.markApplied({
                previous: current,
                current: previousCurrent,
                now,
            }))
            return null
        }
    }

    const current = selectTdpHotUpdateCurrent(runtime.getState())
    if (shouldSyncEmbeddedReleaseCurrent(current)) {
        runtime.getStore().dispatch(tdpHotUpdateActions.markApplied({
            previous: current,
            current: createEmbeddedReleaseCurrent(now),
            now,
        }))
    }

    return null
}
