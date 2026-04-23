import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTdpHotUpdateCurrent} from '../../selectors'
import type {
    HotUpdateAppliedVersion,
    HotUpdateEmbeddedReleaseFacts,
} from '../../types'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpHotUpdateActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

const createEmbeddedCurrent = (
    embeddedRelease: HotUpdateEmbeddedReleaseFacts,
    now: number,
): HotUpdateAppliedVersion => ({
    source: 'embedded',
    ...embeddedRelease,
    appliedAt: now,
})

const createHotUpdateCurrent = (
    input: {
        embeddedRelease: HotUpdateEmbeddedReleaseFacts
        marker: Record<string, unknown>
        now: number
    },
): HotUpdateAppliedVersion | null => {
    const bundleVersion = input.marker.bundleVersion
    const installDir = input.marker.installDir
    if (typeof bundleVersion !== 'string' || typeof installDir !== 'string') {
        return null
    }

    return {
        source: 'hot-update',
        ...input.embeddedRelease,
        bundleVersion,
        packageId: typeof input.marker.packageId === 'string' ? input.marker.packageId : undefined,
        releaseId: typeof input.marker.releaseId === 'string' ? input.marker.releaseId : undefined,
        installDir,
        appliedAt: input.now,
    }
}

const createRollbackCurrent = (
    input: {
        embeddedRelease: HotUpdateEmbeddedReleaseFacts
        now: number
    },
): HotUpdateAppliedVersion => ({
    source: 'rollback',
    ...input.embeddedRelease,
    appliedAt: input.now,
})

const isSameCurrent = (
    left: HotUpdateAppliedVersion | undefined,
    right: HotUpdateAppliedVersion,
): boolean => (
    left?.source === right.source
    && left.appId === right.appId
    && left.assemblyVersion === right.assemblyVersion
    && left.buildNumber === right.buildNumber
    && left.runtimeVersion === right.runtimeVersion
    && left.bundleVersion === right.bundleVersion
    && left.packageId === right.packageId
    && left.releaseId === right.releaseId
    && left.installDir === right.installDir
)

const shouldSyncEmbeddedCurrent = (
    current: HotUpdateAppliedVersion | undefined,
    embeddedRelease: HotUpdateEmbeddedReleaseFacts,
): boolean => (
    current?.source !== 'embedded'
    || current.appId !== embeddedRelease.appId
    || current.assemblyVersion !== embeddedRelease.assemblyVersion
    || current.buildNumber !== embeddedRelease.buildNumber
    || current.runtimeVersion !== embeddedRelease.runtimeVersion
    || current.bundleVersion !== embeddedRelease.bundleVersion
)

const markApplied = (
    context: Parameters<NonNullable<ActorDefinition['handlers']>[number]['handle']>[0],
    current: HotUpdateAppliedVersion,
    now: number,
) => {
    const previous = selectTdpHotUpdateCurrent(context.getState())
    context.dispatchAction(tdpHotUpdateActions.markApplied({
        previous,
        current,
        now,
    }))
}

const readMarker = async (
    action: (() => Promise<Record<string, unknown> | null>) | undefined,
): Promise<Record<string, unknown> | null> => {
    if (!action) {
        return null
    }
    return action().catch(() => null)
}

export const createTdpHotUpdateNativeBootActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpHotUpdateNativeBootActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot, async context => {
            const now = Date.now()
            const port = context.platformPorts.hotUpdate
            const embeddedRelease = context.command.payload.embeddedRelease
            const rollbackMarker = await readMarker(port?.readRollbackMarker?.bind(port))
            if (rollbackMarker?.rollbackReason) {
                const current = createRollbackCurrent({embeddedRelease, now})
                markApplied(context, current, now)
                context.dispatchAction(tdpHotUpdateActions.markFailed({
                    code: String(rollbackMarker.rollbackReason),
                    message: `Hot update rolled back: ${String(rollbackMarker.rollbackReason)}`,
                    at: now,
                }))
                return {
                    terminalState: 'ROLLED_BACK' as const,
                    reason: String(rollbackMarker.rollbackReason),
                }
            }

            const activeMarker = await readMarker(port?.readActiveMarker?.bind(port))
            const hotUpdateCurrent = activeMarker
                ? createHotUpdateCurrent({embeddedRelease, marker: activeMarker, now})
                : null
            if (hotUpdateCurrent) {
                markApplied(context, hotUpdateCurrent, now)
                return {
                    terminalState: 'RUNNING' as const,
                    source: 'hot-update' as const,
                }
            }

            const current = selectTdpHotUpdateCurrent(context.getState())
            const previousCurrent = context.command.payload.previousCurrent
            if (
                context.command.payload.initializeEmbeddedCurrent === false
                && previousCurrent
                && (previousCurrent.source === 'hot-update' || previousCurrent.source === 'rollback')
                && !isSameCurrent(current, previousCurrent)
            ) {
                markApplied(context, previousCurrent, now)
                return {
                    terminalState: 'RUNNING' as const,
                    source: previousCurrent.source,
                }
            }

            if (shouldSyncEmbeddedCurrent(current, embeddedRelease)) {
                markApplied(context, createEmbeddedCurrent(embeddedRelease, now), now)
                return {
                    terminalState: 'RUNNING' as const,
                    source: 'embedded' as const,
                }
            }

            return {
                terminalState: 'RUNNING' as const,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.confirmHotUpdateLoadComplete, async context => {
            const now = Date.now()
            const port = context.platformPorts.hotUpdate
            const marker = await (
                port?.confirmLoadComplete
                    ? port.confirmLoadComplete({displayIndex: context.command.payload.displayIndex}).catch(() => null)
                    : port?.reportLoadComplete
                        ? port.reportLoadComplete({displayIndex: context.command.payload.displayIndex ?? 0}).then(() => null).catch(() => null)
                        : Promise.resolve(null)
            )
            const hotUpdateCurrent = marker
                ? createHotUpdateCurrent({
                    embeddedRelease: context.command.payload.embeddedRelease,
                    marker,
                    now,
                })
                : null
            if (hotUpdateCurrent) {
                markApplied(context, hotUpdateCurrent, now)
                return {
                    terminalState: 'RUNNING' as const,
                    source: 'hot-update' as const,
                }
            }
            return {
                terminalState: 'RUNNING' as const,
            }
        }),
    ],
)
