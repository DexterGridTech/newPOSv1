import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
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

export const syncHotUpdateStateFromNativeBoot = async (
    runtime: KernelRuntimeV2,
): Promise<ReportAppLoadCompleteResult | null> => {
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
                appliedAt: Date.now(),
            },
            now: Date.now(),
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
                appliedAt: Date.now(),
            },
        }))
    }

    return null
}
