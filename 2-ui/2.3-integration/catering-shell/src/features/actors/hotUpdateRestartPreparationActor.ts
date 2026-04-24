import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
    type RuntimeModuleContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    selectUiOverlays,
    uiRuntimeV2CommandDefinitions,
} from '@next/kernel-base-ui-runtime-v2'
import {runtimeReactDefaultParts} from '@next/ui-base-runtime-react'
import {moduleName} from '../../moduleName'

export const CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID = 'catering-shell.hot-update.restart-progress'

const HOT_UPDATE_RESTART_COUNTDOWN_SECONDS = 3

const defineActor = createModuleActorFactory(moduleName)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const hasHotUpdateRestartOverlay = (
    context: Pick<RuntimeModuleContextV2, 'getState'>,
) => selectUiOverlays(context.getState()).some(
    overlay => overlay.id === CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
)

export const createCateringShellHotUpdateRestartPreparationActorDefinition = (): ActorDefinition =>
    defineActor('CateringShellHotUpdateRestartPreparationActor', [
        onCommand(tdpSyncV2CommandDefinitions.requestHotUpdateRestartPreparation, async context => {
            const logger = context.platformPorts.logger.scope({
                moduleName,
                layer: 'ui',
                subsystem: 'hot-update',
                component: 'CateringShellHotUpdateRestartPreparationActor',
            })

            logger.info({
                category: 'catering-shell.hot-update',
                event: 'restart-progress-overlay-open',
                message: 'Opening hot update restart progress overlay',
                data: {
                    releaseId: context.command.payload.releaseId,
                    packageId: context.command.payload.packageId,
                    bundleVersion: context.command.payload.bundleVersion,
                    mode: context.command.payload.mode,
                    displayIndex: context.command.payload.displayIndex,
                    overlayId: CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
                    countdownSeconds: HOT_UPDATE_RESTART_COUNTDOWN_SECONDS,
                },
            })

            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.openOverlay, {
                definition: runtimeReactDefaultParts.hotUpdateProgressModal.definition,
                id: CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
                props: {
                    title: '程序更新中',
                    countdownSeconds: HOT_UPDATE_RESTART_COUNTDOWN_SECONDS,
                },
            }))

            await sleep(HOT_UPDATE_RESTART_COUNTDOWN_SECONDS * 1000)

            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                overlayId: CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
            }))

            const deadline = Date.now() + 5_000
            while (Date.now() < deadline) {
                if (!hasHotUpdateRestartOverlay(context)) {
                    logger.info({
                        category: 'catering-shell.hot-update',
                        event: 'restart-progress-overlay-closed',
                        message: 'Hot update restart progress overlay closed',
                        data: {
                            overlayId: CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
                        },
                    })
                    return {
                        status: 'COMPLETED',
                        overlayId: CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
                    }
                }
                await sleep(50)
            }

            logger.error({
                category: 'catering-shell.hot-update',
                event: 'restart-progress-overlay-close-timeout',
                message: 'Hot update restart progress overlay was not removed before restart',
                data: {
                    overlayId: CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID,
                    timeoutMs: 5_000,
                },
                error: {
                    message: 'HOT_UPDATE_PROGRESS_MODAL_NOT_CLOSED',
                },
            })
            throw new Error('HOT_UPDATE_PROGRESS_MODAL_NOT_CLOSED')
        }),
    ])
