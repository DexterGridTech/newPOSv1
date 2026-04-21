import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectUiOverlays,
    uiRuntimeV2CommandDefinitions,
} from '@impos2/kernel-base-ui-runtime-v2'
import {runtimeReactDefaultParts} from '@impos2/ui-base-runtime-react'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'

const HOT_UPDATE_OVERLAY_ID = 'assembly.hot-update.progress'
const HOT_UPDATE_COUNTDOWN_SECONDS = 3

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const hasHotUpdateOverlay = (context: RuntimeModuleContextV2) =>
    selectUiOverlays(context.getState()).some(overlay => overlay.id === HOT_UPDATE_OVERLAY_ID)

export const prepareHotUpdateRestart = async (input: {
    context: RuntimeModuleContextV2
    releaseId: string
    packageId: string
    bundleVersion: string
    mode: 'immediate' | 'idle'
}): Promise<void> => {
    const {context} = input
    const logger = context.platformPorts.logger.scope({
        moduleName: 'assembly.android.mixc-retail-rn84',
        layer: 'assembly',
        subsystem: 'hot-update',
        component: 'PrepareHotUpdateRestart',
    })

    logger.info({
        category: 'assembly.hot-update',
        event: 'prepare-restart-started',
        message: 'Preparing hot update restart countdown',
        data: {
            releaseId: input.releaseId,
            packageId: input.packageId,
            bundleVersion: input.bundleVersion,
            mode: input.mode,
            overlayId: HOT_UPDATE_OVERLAY_ID,
            countdownSeconds: HOT_UPDATE_COUNTDOWN_SECONDS,
        },
    })

    await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.openOverlay, {
        definition: runtimeReactDefaultParts.hotUpdateProgressModal.definition,
        id: HOT_UPDATE_OVERLAY_ID,
        props: {
            title: '程序更新中',
            countdownSeconds: HOT_UPDATE_COUNTDOWN_SECONDS,
        },
    }))

    logger.info({
        category: 'assembly.hot-update',
        event: 'progress-overlay-opened',
        message: 'Hot update progress overlay opened',
        data: {
            overlayId: HOT_UPDATE_OVERLAY_ID,
        },
    })

    await sleep(HOT_UPDATE_COUNTDOWN_SECONDS * 1000)

    logger.info({
        category: 'assembly.hot-update',
        event: 'progress-countdown-finished',
        message: 'Hot update progress countdown finished',
        data: {
            overlayId: HOT_UPDATE_OVERLAY_ID,
        },
    })

    await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
        overlayId: HOT_UPDATE_OVERLAY_ID,
    }))

    logger.info({
        category: 'assembly.hot-update',
        event: 'progress-overlay-close-dispatched',
        message: 'Dispatched hot update progress overlay close command',
        data: {
            overlayId: HOT_UPDATE_OVERLAY_ID,
        },
    })

    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
        if (!hasHotUpdateOverlay(context)) {
            logger.info({
                category: 'assembly.hot-update',
                event: 'progress-overlay-removed',
                message: 'Hot update progress overlay removed before restart',
                data: {
                    overlayId: HOT_UPDATE_OVERLAY_ID,
                },
            })
            return
        }
        await sleep(50)
    }

    logger.error({
        category: 'assembly.hot-update',
        event: 'progress-overlay-close-timeout',
        message: 'Hot update progress overlay was not removed before restart',
        data: {
            overlayId: HOT_UPDATE_OVERLAY_ID,
            timeoutMs: 5_000,
        },
        error: {
            message: 'HOT_UPDATE_PROGRESS_MODAL_NOT_CLOSED',
        },
    })
    throw new Error('HOT_UPDATE_PROGRESS_MODAL_NOT_CLOSED')
}
