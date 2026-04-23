import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {TopologyHostAddressInfo} from '@impos2/kernel-base-platform-ports'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV3CommandDefinitions} from '../commands'
import {topologyRuntimeV3StateActions} from '../slices'
import {
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
    selectTopologyRuntimeV3Host,
} from '../../selectors'

const defineActor = createModuleActorFactory(moduleName)

const shouldRunTopologyHost = (
    context: ReturnType<typeof selectTopologyRuntimeV3Context>,
): boolean => (
    context?.displayCount === 1
    && context.displayIndex === 0
    && context.instanceMode === 'MASTER'
    && context.enableSlave === true
)

const createStandaloneSlaveAutoStartKey = (
    context: ReturnType<typeof selectTopologyRuntimeV3Context>,
): string | null => {
    if (!context || context.standalone !== true || context.instanceMode !== 'SLAVE') {
        return null
    }
    const serverAddress = Array.isArray(context.masterLocator?.serverAddress)
        ? context.masterLocator.serverAddress
            .map(entry => entry?.address)
            .filter((address): address is string => typeof address === 'string' && address.length > 0)
        : []
    const httpBaseUrl = typeof context.masterLocator?.httpBaseUrl === 'string'
        ? context.masterLocator.httpBaseUrl
        : ''
    if (serverAddress.length === 0 && !httpBaseUrl) {
        return null
    }
    return JSON.stringify({
        localNodeId: context.localNodeId,
        displayMode: context.displayMode,
        masterNodeId: context.masterLocator?.masterNodeId ?? '',
        masterDeviceId: context.masterLocator?.masterDeviceId ?? '',
        serverAddress,
        httpBaseUrl,
    })
}

const toAddressInfoRecord = (
    addressInfo: TopologyHostAddressInfo | Record<string, unknown> | undefined,
): Record<string, unknown> | undefined =>
    addressInfo && typeof addressInfo === 'object'
        ? addressInfo as Record<string, unknown>
        : undefined

const resolveBindingUrls = (
    value: TopologyHostAddressInfo | Record<string, unknown> | undefined,
): {
    wsUrl?: string
    httpBaseUrl?: string
} => {
    const record = toAddressInfoRecord(value)
    const nested = record?.addressInfo && typeof record.addressInfo === 'object'
        ? record.addressInfo as Record<string, unknown>
        : record
    const wsUrl = typeof nested?.localWsUrl === 'string'
        ? nested.localWsUrl
        : typeof nested?.wsUrl === 'string'
            ? nested.wsUrl
            : undefined
    const httpBaseUrl = typeof nested?.localHttpBaseUrl === 'string'
        ? nested.localHttpBaseUrl
        : typeof nested?.httpBaseUrl === 'string'
            ? nested.httpBaseUrl
            : undefined
    return {wsUrl, httpBaseUrl}
}

let lifecycleSyncChain = Promise.resolve()

const enqueueLifecycleSync = <T>(
    run: () => Promise<T>,
): Promise<T> => {
    const next = lifecycleSyncChain.then(run, run)
    lifecycleSyncChain = next.then(
        () => undefined,
        () => undefined,
    )
    return next
}

export const createTopologyRuntimeV3HostLifecycleActor = (): ActorDefinition =>
    defineActor('TopologyHostLifecycleActor', [
        onCommand(topologyRuntimeV3CommandDefinitions.updateTopologyHostBinding, async context => {
            const runtimeContext = selectTopologyRuntimeV3Context(context.getState())
            if (!runtimeContext || runtimeContext.instanceMode !== 'MASTER') {
                return {
                    status: 'SKIPPED',
                    reason: 'master-only-binding-update',
                }
            }
            if (!context.command.payload.wsUrl && !context.command.payload.httpBaseUrl) {
                return {
                    status: 'SKIPPED',
                    reason: 'binding-urls-empty',
                }
            }
            const masterLocator = {
                masterNodeId: String(runtimeContext.localNodeId),
                serverAddress: context.command.payload.wsUrl
                    ? [{address: context.command.payload.wsUrl}]
                    : [],
                httpBaseUrl: context.command.payload.httpBaseUrl,
                addedAt: Date.now(),
            }
            context.dispatchAction(topologyRuntimeV3StateActions.patchConfigState({
                masterLocator,
            }))
            return {
                status: 'COMPLETED',
                masterLocator,
            }
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.syncTopologyHostLifecycle, async context => enqueueLifecycleSync(async () => {
            const runtimeContext = selectTopologyRuntimeV3Context(context.getState())
            const connectionState = selectTopologyRuntimeV3Connection(context.getState())
            const hostState = selectTopologyRuntimeV3Host(context.getState())
            const desiredRunning = shouldRunTopologyHost(runtimeContext)
            const topologyHost = context.platformPorts.topologyHost

            context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                desiredRunning,
            }))

            const autoStartKey = createStandaloneSlaveAutoStartKey(runtimeContext)

            if (
                autoStartKey
                && connectionState?.serverConnectionStatus === 'DISCONNECTED'
                && hostState?.lastAutoStartKey !== autoStartKey
            ) {
                await context.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.startTopologyConnection,
                    {},
                ))
                context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                    lastAutoStartKey: autoStartKey,
                }))
                context.dispatchAction(topologyRuntimeV3StateActions.patchSyncState({
                    standaloneSlaveAutoStartKey: autoStartKey,
                }))
                return {
                    status: 'COMPLETED',
                    desiredRunning,
                    autoStarted: true,
                }
            }

            if (!autoStartKey && hostState?.lastAutoStartKey) {
                context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                    lastAutoStartKey: undefined,
                }))
            }

            if (!topologyHost) {
                return {
                    status: 'SKIPPED',
                    reason: 'topology-host-port-unavailable',
                    desiredRunning,
                    autoStarted: false,
                }
            }

            if (desiredRunning && !hostState?.actualRunning) {
                context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                    transitionStatus: 'starting',
                    lastError: undefined,
                }))
                try {
                    const addressInfo = await topologyHost.start({
                        displayCount: runtimeContext?.displayCount,
                        displayIndex: runtimeContext?.displayIndex,
                        deviceId: runtimeContext?.localNodeId,
                    })
                    const binding = resolveBindingUrls(addressInfo)
                    if (binding.wsUrl || binding.httpBaseUrl) {
                        await context.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.updateTopologyHostBinding,
                            binding,
                        ))
                    }
                    await context.dispatchCommand(createCommand(
                        topologyRuntimeV3CommandDefinitions.startTopologyConnection,
                        {},
                    ))
                    const statusSnapshot = topologyHost.getStatus
                        ? await topologyHost.getStatus()
                        : null
                    const diagnosticsSnapshot = topologyHost.getDiagnosticsSnapshot
                        ? await topologyHost.getDiagnosticsSnapshot()
                        : null
                    context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                        actualRunning: true,
                        transitionStatus: 'idle',
                        statusSnapshot,
                        diagnosticsSnapshot,
                    }))
                } catch (error) {
                    context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                        actualRunning: false,
                        transitionStatus: 'idle',
                        lastError: error instanceof Error ? error.message : String(error),
                    }))
                    throw error
                }
                return {
                    status: 'COMPLETED',
                    desiredRunning,
                }
            }

            if (!desiredRunning && hostState?.actualRunning) {
                context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                    transitionStatus: 'stopping',
                    lastError: undefined,
                }))
                try {
                    await topologyHost.stop()
                    const statusSnapshot = topologyHost.getStatus
                        ? await topologyHost.getStatus()
                        : null
                    const diagnosticsSnapshot = topologyHost.getDiagnosticsSnapshot
                        ? await topologyHost.getDiagnosticsSnapshot()
                        : null
                    context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                        actualRunning: false,
                        transitionStatus: 'idle',
                        statusSnapshot,
                        diagnosticsSnapshot,
                    }))
                } catch (error) {
                    context.dispatchAction(topologyRuntimeV3StateActions.patchHostState({
                        transitionStatus: 'idle',
                        lastError: error instanceof Error ? error.message : String(error),
                    }))
                    throw error
                }
                return {
                    status: 'COMPLETED',
                    desiredRunning,
                }
            }

            return {
                status: 'COMPLETED',
                desiredRunning,
                autoStarted: false,
            }
        })),
    ])
