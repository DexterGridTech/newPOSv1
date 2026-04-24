import type {
    KernelRuntimeV2,
    RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    selectTdpHotUpdateCurrent,
    tdpSyncV2CommandDefinitions,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {getHostRuntimeReleaseInfo} from './releaseInfoContext'

export interface ReportAppLoadCompleteResult {
    terminalState: 'RUNNING' | 'ROLLED_BACK'
    reason?: string
}

type HotUpdateStateSyncRuntime = Pick<KernelRuntimeV2, 'dispatchCommand'>
    | Pick<RuntimeModuleContextV2, 'dispatchCommand'>

export const syncHotUpdateStateFromNativeBoot = async (
    runtime: HotUpdateStateSyncRuntime,
    options: {
        initializeEmbeddedCurrent?: boolean
        previousState?: RootState
    } = {},
): Promise<ReportAppLoadCompleteResult | null> => {
    const releaseInfo = getHostRuntimeReleaseInfo()
    const previousCurrent = options.previousState
        ? selectTdpHotUpdateCurrent(options.previousState)
        : undefined
    const result = await runtime.dispatchCommand(createCommand(
        tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
        {
            embeddedRelease: {
                appId: releaseInfo.appId,
                assemblyVersion: releaseInfo.assemblyVersion,
                buildNumber: releaseInfo.buildNumber,
                runtimeVersion: releaseInfo.runtimeVersion,
                bundleVersion: releaseInfo.bundleVersion,
            },
            initializeEmbeddedCurrent: options.initializeEmbeddedCurrent ?? true,
            previousCurrent,
        },
    ))

    return (result.actorResults[0]?.result as ReportAppLoadCompleteResult | undefined) ?? null
}
