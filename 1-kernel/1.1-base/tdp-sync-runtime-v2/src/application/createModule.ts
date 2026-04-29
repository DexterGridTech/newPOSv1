import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {createTdpSyncActorDefinitionsV2} from '../features/actors'
import {createTopicChangePublisherFingerprintV2} from '../foundations/topicChangePublisher'
import {
    createDefaultTdpSyncHttpRuntimeV2,
    installTdpSessionConnectionRuntimeV2,
} from '../foundations/sessionConnectionRuntime'
import {createTdpSyncHttpServiceV2} from '../foundations/httpService'
import {
    resolveHttpUrlCandidates,
} from '@next/kernel-base-transport-runtime'
import {
    selectTopologyRuntimeV3Context,
} from '@next/kernel-base-topology-runtime-v3'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {
    selectTdpHotUpdateCandidate,
    selectTdpHotUpdateCurrent,
    selectTdpHotUpdateDesired,
    selectTdpHotUpdateRestartIntent,
    selectTdpHotUpdateReady,
} from '../selectors'
import {tdpHotUpdateActions} from '../features/slices'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import type {
    CreateTdpSyncRuntimeModuleV2Input,
    TdpSyncHttpServiceRefV2,
} from '../types'
import {tdpSyncRuntimeV2ModuleManifest} from './moduleManifest'
import {tdpSyncV2ParameterDefinitions} from '../supports/parameters'

/**
 * 设计意图：
 * 模块安装时只准备 TDP 运行时引用并挂上 actor，不在 install 阶段提前掺入业务模块分支。
 * projection 仓库、topic 变化和 system catalog 桥接都通过 command/actor 正式流转，便于后续业务包按能力订阅。
 */
export const tdpSyncRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTdpSyncRuntimeModuleV2 = (
    input: CreateTdpSyncRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const fingerprintRef = createTopicChangePublisherFingerprintV2()
    const connectionRuntimeRef = {}
    const httpServiceRef: TdpSyncHttpServiceRefV2 = {}
    const installingPackageIds = new Set<string>()
    const restartingPackageIds = new Set<string>()
    let idleRestartTimer: ReturnType<typeof setTimeout> | null = null
    let downloadRetryTimer: ReturnType<typeof setTimeout> | null = null
    let projectionExpiryCleanupTimer: ReturnType<typeof setInterval> | null = null

    const clearIdleRestartTimer = () => {
        if (idleRestartTimer) {
            clearTimeout(idleRestartTimer)
            idleRestartTimer = null
        }
    }
    const clearDownloadRetryTimer = () => {
        if (downloadRetryTimer) {
            clearTimeout(downloadRetryTimer)
            downloadRetryTimer = null
        }
    }
    const clearProjectionExpiryCleanupTimer = () => {
        if (projectionExpiryCleanupTimer) {
            clearInterval(projectionExpiryCleanupTimer)
            projectionExpiryCleanupTimer = null
        }
    }

    return defineKernelRuntimeModuleV2({
        ...tdpSyncRuntimeV2ModuleManifest,
        actorDefinitions: createTdpSyncActorDefinitionsV2(
            fingerprintRef,
            connectionRuntimeRef,
            httpServiceRef,
            input,
        ),
        preSetup: tdpSyncRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            const hotUpdatePort = input.hotUpdate?.getPort?.(context)
            const httpRuntime = input.assembly?.createHttpRuntime(context) ?? createDefaultTdpSyncHttpRuntimeV2(context)
            const resolveIdleThresholdMs = () => {
                const resolved = context.resolveParameter({
                    key: tdpSyncV2ParameterDefinitions.hotUpdateIdleThresholdMs.key,
                    definition: tdpSyncV2ParameterDefinitions.hotUpdateIdleThresholdMs,
                })
                if (typeof resolved.value === 'number' && Number.isFinite(resolved.value) && resolved.value > 0) {
                    return resolved.value
                }
                return tdpSyncV2ParameterDefinitions.hotUpdateIdleThresholdMs.defaultValue
            }
            const scheduleDownloadRetry = (packageId: string) => {
                clearDownloadRetryTimer()
                const delay = Math.max(0, input.hotUpdate?.downloadRetryDelayMs ?? 1_000)
                downloadRetryTimer = setTimeout(() => {
                    downloadRetryTimer = null
                    const state = context.getState()
                    const desired = selectTdpHotUpdateDesired(state)
                    const candidate = selectTdpHotUpdateCandidate(state)
                    if (
                        desired?.packageId === packageId
                        && candidate?.packageId === packageId
                        && candidate.status === 'failed'
                        && (candidate.attempts ?? 0) < desired.safety.maxDownloadAttempts
                    ) {
                        context.dispatchAction(tdpHotUpdateActions.markDownloadRetryPending({
                            releaseId: desired.releaseId,
                            packageId: desired.packageId,
                            bundleVersion: desired.bundleVersion,
                        }))
                    }
                }, delay)
            }
            const restartNow = async (restartMode: 'immediate' | 'idle') => {
                const state = context.getState()
                const desired = selectTdpHotUpdateDesired(state)
                const ready = selectTdpHotUpdateReady(state)
                const applying = state['kernel.base.tdp-sync-runtime-v2.hot-update' as keyof typeof state] as {applying?: {packageId?: string}} | undefined
                if (!desired || !ready) {
                    return
                }
                if (desired.packageId !== ready.packageId || applying?.applying?.packageId !== desired.packageId) {
                    return
                }
                if (restartingPackageIds.has(desired.packageId)) {
                    return
                }

                restartingPackageIds.add(desired.packageId)
                clearIdleRestartTimer()
                context.dispatchAction(tdpHotUpdateActions.markRestartPreparing({}))

                try {
                    const restartPreparationCommand = input.hotUpdate?.createRestartPreparationCommand?.({
                        context,
                        displayIndex: context.displayContext.displayIndex ?? 0,
                        releaseId: desired.releaseId,
                        packageId: desired.packageId,
                        bundleVersion: desired.bundleVersion,
                        mode: restartMode,
                    }) ?? createCommand(
                        tdpSyncV2CommandDefinitions.requestHotUpdateRestartPreparation,
                        {
                            displayIndex: context.displayContext.displayIndex ?? 0,
                            releaseId: desired.releaseId,
                            packageId: desired.packageId,
                            bundleVersion: desired.bundleVersion,
                            mode: restartMode,
                        },
                    )
                    const preparationResult = await context.dispatchCommand(restartPreparationCommand)
                    if (preparationResult.status !== 'COMPLETED') {
                        const preparationError = preparationResult.actorResults.find(result => result.error)?.error
                        throw new Error(
                            preparationError?.message
                            ?? 'HOT_UPDATE_RESTART_PREPARE_FAILED',
                        )
                    }
                    context.dispatchAction(tdpHotUpdateActions.markRestartReady({}))
                    await context.platformPorts.appControl?.restartApp?.()
                } catch (error) {
                    context.dispatchAction(tdpHotUpdateActions.markFailed({
                        code: error instanceof Error ? error.message : 'HOT_UPDATE_RESTART_PREPARE_FAILED',
                        message: error instanceof Error ? error.message : String(error),
                    }))
                    context.dispatchAction(tdpHotUpdateActions.clearRestartIntent())
                } finally {
                    restartingPackageIds.delete(desired.packageId)
                }
            }
            const scheduleIdleRestart = (nextEligibleAt: number) => {
                clearIdleRestartTimer()
                const delay = Math.max(0, nextEligibleAt - Date.now())
                idleRestartTimer = setTimeout(() => {
                    idleRestartTimer = null
                    void restartNow('idle')
                }, delay)
            }

            httpServiceRef.current = createTdpSyncHttpServiceV2(httpRuntime)
            installTdpSessionConnectionRuntimeV2({
                context,
                moduleInput: input,
                connectionRuntimeRef,
            })
            clearProjectionExpiryCleanupTimer()
            if (input.projectionExpiryCleanup?.enabled !== false) {
                const cleanupIntervalMs = Math.max(
                    1,
                    input.projectionExpiryCleanup?.intervalMs ?? 5 * 60 * 1000,
                )
                projectionExpiryCleanupTimer = setInterval(() => {
                    void context.dispatchCommand(createCommand(
                        tdpSyncV2CommandDefinitions.cleanupExpiredTdpProjections,
                        {},
                    ))
                }, cleanupIntervalMs)
                projectionExpiryCleanupTimer.unref?.()
            }
            context.subscribeState(() => {
                if (!hotUpdatePort) {
                    return
                }

                const state = context.getState()
                const topology = selectTopologyRuntimeV3Context(state)
                const isInstallOwner = topology == null
                    ? (context.displayContext.displayIndex ?? 0) === 0
                    : topology.standalone

                if (!isInstallOwner) {
                    return
                }

                const desired = selectTdpHotUpdateDesired(state)
                const candidate = selectTdpHotUpdateCandidate(state)
                if (
                    desired
                    && !candidate
                    && selectTdpHotUpdateCurrent(state)?.packageId !== desired.packageId
                ) {
                    context.dispatchAction(tdpHotUpdateActions.reconcileDesired({
                        desired,
                        currentFacts: input.hotUpdate?.getCurrentFacts?.(context),
                        idleThresholdMs: resolveIdleThresholdMs(),
                    }))
                    return
                }
                if (desired && candidate?.status === 'download-pending' && !installingPackageIds.has(candidate.packageId)) {
                    const nextAttempt = (candidate.attempts ?? 0) + 1
                    const maxAttempts = desired.safety.maxDownloadAttempts
                    if (nextAttempt > maxAttempts) {
                        context.dispatchAction(tdpHotUpdateActions.markFailed({
                            code: 'HOT_UPDATE_MAX_ATTEMPTS_EXCEEDED',
                            message: `Hot update max attempts exceeded for ${candidate.packageId}`,
                        }))
                    } else {
                        installingPackageIds.add(candidate.packageId)
                        context.dispatchAction(tdpHotUpdateActions.markDownloading({
                            releaseId: candidate.releaseId,
                            packageId: candidate.packageId,
                            bundleVersion: candidate.bundleVersion,
                            attempts: nextAttempt,
                        }))

                        void (async () => {
                            try {
                                const packageUrls = resolveHttpUrlCandidates({
                                    runtime: httpRuntime,
                                    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
                                    pathOrUrl: desired.packageUrl,
                                })
                                const result = await hotUpdatePort.downloadPackage({
                                    packageId: desired.packageId,
                                    releaseId: desired.releaseId,
                                    bundleVersion: desired.bundleVersion,
                                    packageUrls,
                                    packageSha256: desired.packageSha256,
                                    manifestSha256: desired.manifestSha256,
                                    packageSize: desired.packageSize,
                                })
                                context.dispatchAction(tdpHotUpdateActions.markReady({
                                    releaseId: desired.releaseId,
                                    packageId: desired.packageId,
                                    bundleVersion: desired.bundleVersion,
                                    installDir: result.installDir,
                                    entryFile: result.entryFile,
                                    packageSha256: result.packageSha256,
                                    manifestSha256: result.manifestSha256,
                                }))

                                const marker = await hotUpdatePort.writeBootMarker({
                                    releaseId: desired.releaseId,
                                    packageId: desired.packageId,
                                    bundleVersion: desired.bundleVersion,
                                    installDir: result.installDir,
                                    entryFile: result.entryFile,
                                    manifestSha256: result.manifestSha256,
                                    maxLaunchFailures: desired.safety.maxLaunchFailures,
                                    healthCheckTimeoutMs: desired.safety.healthCheckTimeoutMs,
                                })
                                context.dispatchAction(tdpHotUpdateActions.markApplying({
                                    releaseId: desired.releaseId,
                                    packageId: desired.packageId,
                                    bundleVersion: desired.bundleVersion,
                                    bootMarkerPath: marker.bootMarkerPath,
                                }))

                                if (desired.restart.mode === 'immediate' || desired.restart.mode === 'idle') {
                                    context.dispatchAction(tdpHotUpdateActions.markRestartPending({
                                        desired,
                                        idleThresholdMs: resolveIdleThresholdMs(),
                                    }))
                                }
                            } catch (error) {
                                const attempts = selectTdpHotUpdateCandidate(context.getState())?.attempts ?? nextAttempt
                                context.dispatchAction(tdpHotUpdateActions.markFailed({
                                    code: error instanceof Error ? error.message : 'HOT_UPDATE_INSTALL_FAILED',
                                    message: error instanceof Error ? error.message : String(error),
                                }))
                                if (attempts < maxAttempts) {
                                    scheduleDownloadRetry(candidate.packageId)
                                }
                            } finally {
                                installingPackageIds.delete(candidate.packageId)
                            }
                        })()
                    }
                }

                const restartIntent = selectTdpHotUpdateRestartIntent(context.getState())
                const ready = selectTdpHotUpdateReady(context.getState())
                if (!restartIntent || !ready || restartIntent.packageId !== ready.packageId) {
                    clearIdleRestartTimer()
                    return
                }

                if (restartIntent.status === 'preparing' || restartIntent.status === 'ready-to-restart') {
                    clearIdleRestartTimer()
                    return
                }

                if (restartIntent.mode === 'immediate' && restartIntent.status === 'pending') {
                    void restartNow('immediate')
                    return
                }

                if (restartIntent.mode === 'idle') {
                    const idleThresholdMs = Math.max(1, restartIntent.idleThresholdMs ?? resolveIdleThresholdMs())
                    const nextEligibleAt = (restartIntent.lastUserOperationAt ?? restartIntent.requestedAt) + idleThresholdMs
                    if (nextEligibleAt <= Date.now()) {
                        void restartNow('idle')
                        return
                    }
                    scheduleIdleRestart(nextEligibleAt)
                    return
                }
            })
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: tdpSyncRuntimeV2ModuleManifest.stateSliceNames,
                commandNames: tdpSyncRuntimeV2ModuleManifest.commandNames,
                hasAssembly: Boolean(input.assembly),
            })
        },
    })
}

export const tdpSyncRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTdpSyncRuntimeModuleV2)
