import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    tdpSyncV2CommandDefinitions,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {releaseInfo} from '../generated/releaseInfo'
import {nativeAppControl, nativeLogger} from '../turbomodules'
import {
    syncHotUpdateStateFromNativeBoot,
    type ReportAppLoadCompleteResult,
} from './syncHotUpdateStateFromNativeBoot'

/**
 * 设计意图：
 * Assembly 是 React 内容与 Android 宿主启动编排之间的边界层。
 * 当首屏 React 内容已经稳定可渲染时，必须显式通知原生：
 * 1. 关闭主屏启动遮罩；
 * 2. 让 StartupCoordinator 继续副屏拉起等后续动作。
 *
 * 这不是 retail-shell 或 ui-runtime 的职责，所以收敛在 assembly application。
 */
export const reportAppLoadComplete = async (
    runtime: KernelRuntimeV2,
    displayIndex: number,
): Promise<ReportAppLoadCompleteResult> => {
    nativeLogger.log(
        'assembly.android.mixc-retail-rn84.boot',
        JSON.stringify({
            stage: 'app-load-complete:start',
            displayIndex,
        }),
    )

    await nativeAppControl.hideLoading(displayIndex)
    const bootState = await syncHotUpdateStateFromNativeBoot(runtime, {
        initializeEmbeddedCurrent: false,
    })
    if (bootState?.terminalState === 'ROLLED_BACK') {
        nativeLogger.log(
            'assembly.android.mixc-retail-rn84.boot',
            JSON.stringify({
                stage: 'app-load-complete:done',
                displayIndex,
                terminalState: 'ROLLED_BACK',
                reason: bootState.reason,
            }),
        )
        return bootState
    }

    await runtime.dispatchCommand(createCommand(
        tdpSyncV2CommandDefinitions.confirmHotUpdateLoadComplete,
        {
            embeddedRelease: {
                appId: releaseInfo.appId,
                assemblyVersion: releaseInfo.assemblyVersion,
                buildNumber: releaseInfo.buildNumber,
                runtimeVersion: releaseInfo.runtimeVersion,
                bundleVersion: releaseInfo.bundleVersion,
            },
            displayIndex,
        },
    ))

    nativeLogger.log(
        'assembly.android.mixc-retail-rn84.boot',
        JSON.stringify({
            stage: 'app-load-complete:done',
            displayIndex,
        }),
    )
    return {
        terminalState: 'RUNNING',
    }
}
