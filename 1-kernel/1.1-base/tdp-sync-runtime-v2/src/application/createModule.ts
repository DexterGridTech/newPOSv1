import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@impos2/kernel-base-runtime-shell-v2'
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
} from '@impos2/kernel-base-transport-runtime'
import {
    selectTopologyRuntimeV3Context,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    selectTdpHotUpdateCandidate,
    selectTdpHotUpdateCurrent,
    selectTdpHotUpdateDesired,
    selectTdpHotUpdateReady,
} from '../selectors'
import {tdpHotUpdateActions} from '../features/slices'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@impos2/kernel-server-config-v2'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../types'
import {tdpSyncRuntimeV2ModuleManifest} from './moduleManifest'

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
    const installingPackageIds = new Set<string>()

    return defineKernelRuntimeModuleV2({
        ...tdpSyncRuntimeV2ModuleManifest,
        actorDefinitions: createTdpSyncActorDefinitionsV2(
            fingerprintRef,
            connectionRuntimeRef,
            input,
        ),
        preSetup: tdpSyncRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            const hotUpdatePort = input.hotUpdate?.getPort?.(context)
            const httpRuntime = input.assembly?.createHttpRuntime(context) ?? createDefaultTdpSyncHttpRuntimeV2(context)

            createTdpSyncHttpServiceV2(httpRuntime)
            installTdpSessionConnectionRuntimeV2({
                context,
                moduleInput: input,
                connectionRuntimeRef,
            })
            context.subscribeState(() => {
                if (!hotUpdatePort) {
                    return
                }

                const topology = selectTopologyRuntimeV3Context(context.getState())
                const isPrimaryOwner = topology == null
                    ? (context.displayContext.displayIndex ?? 0) === 0
                    : topology.instanceMode !== 'SLAVE'

                if (!isPrimaryOwner) {
                    return
                }

                const desired = selectTdpHotUpdateDesired(context.getState())
                const candidate = selectTdpHotUpdateCandidate(context.getState())
                if (!desired || !candidate) {
                    return
                }

                if (candidate.status !== 'download-pending') {
                    return
                }

                if (installingPackageIds.has(candidate.packageId)) {
                    return
                }

                const nextAttempt = (candidate.attempts ?? 0) + 1
                const maxAttempts = desired.safety.maxDownloadAttempts
                if (nextAttempt > maxAttempts) {
                    context.dispatchAction(tdpHotUpdateActions.markFailed({
                        code: 'HOT_UPDATE_MAX_ATTEMPTS_EXCEEDED',
                        message: `Hot update max attempts exceeded for ${candidate.packageId}`,
                    }))
                    return
                }

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
                        })
                        context.dispatchAction(tdpHotUpdateActions.markApplying({
                            releaseId: desired.releaseId,
                            packageId: desired.packageId,
                            bundleVersion: desired.bundleVersion,
                            bootMarkerPath: marker.bootMarkerPath,
                        }))

                        if (desired.restart.mode === 'immediate') {
                            await context.platformPorts.appControl?.restartApp?.()
                        }
                    } catch (error) {
                        context.dispatchAction(tdpHotUpdateActions.markFailed({
                            code: error instanceof Error ? error.message : 'HOT_UPDATE_INSTALL_FAILED',
                            message: error instanceof Error ? error.message : String(error),
                        }))
                    } finally {
                        installingPackageIds.delete(candidate.packageId)
                    }
                })()
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
