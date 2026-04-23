import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    parseTopologyV3SharePayload,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    transportRuntimeCommandDefinitions,
} from '@impos2/kernel-base-transport-runtime'
import {
    workflowBuiltinTaskKeys,
    workflowRuntimeV2CommandDefinitions,
} from '@impos2/kernel-base-workflow-runtime-v2'
import {moduleName} from '../../moduleName'
import {getAdminHostTools} from '../../supports/adminHostToolsRegistry'
import type {
    AdminBarcodeScanTaskResult,
    AdminTopologySharePayload,
} from '../../types'
import {adminConsoleCommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined

const readString = (
    record: Record<string, unknown>,
    key: string,
): string | undefined => {
    const value = record[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

const parseBarcodeTaskOutput = (value: unknown): AdminBarcodeScanTaskResult => {
    const output = toRecord(value)
    const barcode = output ? readString(output, 'barcode') : undefined
    if (!barcode) {
        throw new Error('扫码任务未返回二维码内容')
    }
    return {
        barcode,
        format: output ? readString(output, 'format') : undefined,
        raw: output ? toRecord(output.raw) : undefined,
    }
}

const getErrorMessage = (error: unknown): string =>
    error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : 'unknown error'

export const createAdminTopologyActor = (): ActorDefinition => defineActor('AdminTopologyActor', [
    onCommand(adminConsoleCommandDefinitions.scanAndImportTopologyMaster, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        if (!topologyHost?.importSharePayload) {
            throw createAppError({
                key: `${moduleName}.topology_import_host_unavailable`,
                code: 'ERR_ADMIN_CONSOLE_TOPOLOGY_IMPORT_HOST_UNAVAILABLE',
                name: 'Admin Console Topology Import Host Unavailable',
                defaultTemplate: 'Current host does not support importing topology share payload',
                category: 'SYSTEM',
                severity: 'MEDIUM',
                moduleName,
            })
        }

        const workflowResult = await context.dispatchCommand(createCommand(
            workflowRuntimeV2CommandDefinitions.runWorkflow,
            {
                workflowKey: workflowBuiltinTaskKeys.singleReadBarcodeFromCamera,
                input: {
                    scanMode: context.command.payload.scanMode ?? 'QR_CODE_MODE',
                    imageUri: context.command.payload.imageUri,
                    imageBase64: context.command.payload.imageBase64,
                    timeoutMs: context.command.payload.timeoutMs ?? 60_000,
                },
            },
        ))

        const workflowSummary = workflowResult.actorResults[0]?.result
        const terminalStatus = readString(toRecord(workflowSummary) ?? {}, 'status')
        const workflowOutput = toRecord(toRecord(workflowSummary)?.result)?.output
        const workflowError = toRecord(toRecord(workflowSummary)?.error)
        if (workflowResult.status !== 'COMPLETED' || terminalStatus !== 'COMPLETED' || !workflowOutput) {
            throw new Error(
                readString(workflowError ?? {}, 'message')
                ?? readString(toRecord(toRecord(workflowSummary)?.result) ?? {}, 'error')
                ?? '扫码任务执行失败',
            )
        }

        const barcodeResult = parseBarcodeTaskOutput(workflowOutput)
        const sharePayload = parseTopologyV3SharePayload(barcodeResult.barcode) as AdminTopologySharePayload
        await topologyHost.importSharePayload(sharePayload)

        if (context.command.payload.reconnect ?? true) {
            const reconnectResult = await context.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.startTopologyConnection,
                {} as Record<string, never>,
            ))
            if (reconnectResult.status !== 'COMPLETED') {
                const reconnectError = reconnectResult.actorResults.find(result => result.error)?.error
                throw new Error(
                    getErrorMessage(reconnectError)
                    || '导入主机信息后启动 topology 连接失败',
                )
            }
        }

        const statusSnapshot = topologyHost.getTopologyHostStatus
            ? await topologyHost.getTopologyHostStatus()
            : null

        return {
            status: 'COMPLETED',
            barcodeResult,
            sharePayload,
            topologyHostStatus: statusSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.clearTopologyMasterLocator, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        await topologyHost?.clearMasterLocator?.()

        const clearResult = await context.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.clearMasterLocator,
            {} as Record<string, never>,
        ))
        if (clearResult.status !== 'COMPLETED') {
            const clearError = clearResult.actorResults.find(result => result.error)?.error
            throw new Error(
                getErrorMessage(clearError)
                || '清空主机信息失败',
            )
        }

        const statusSnapshot = topologyHost?.getTopologyHostStatus
            ? await topologyHost.getTopologyHostStatus()
            : null

        return {
            status: 'COMPLETED',
            topologyHostStatus: statusSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.refreshTopologyHostStatus, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        const [statusSnapshot, diagnosticsSnapshot] = await Promise.all([
            topologyHost?.getTopologyHostStatus
                ? topologyHost.getTopologyHostStatus()
                : Promise.resolve(null),
            topologyHost?.getTopologyHostDiagnostics
                ? topologyHost.getTopologyHostDiagnostics()
                : Promise.resolve(null),
        ])
        return {
            status: 'COMPLETED',
            topologyHostStatus: statusSnapshot ?? undefined,
            topologyHostDiagnostics: diagnosticsSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.generateTopologySharePayload, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        if (!topologyHost?.getSharePayload) {
            throw new Error('当前 host 未提供可分享的配对信息')
        }
        const sharePayload = await topologyHost.getSharePayload()
        if (!sharePayload) {
            throw new Error('当前 host 未提供可分享的配对信息')
        }
        const statusSnapshot = topologyHost.getTopologyHostStatus
            ? await topologyHost.getTopologyHostStatus()
            : null
        return {
            status: 'COMPLETED',
            sharePayload,
            topologyHostStatus: statusSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.importTopologySharePayload, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        if (!topologyHost?.importSharePayload) {
            throw new Error('当前宿主不支持导入 topology 分享信息')
        }
        await topologyHost.importSharePayload(context.command.payload.sharePayload)
        const statusSnapshot = topologyHost.getTopologyHostStatus
            ? await topologyHost.getTopologyHostStatus()
            : null
        return {
            status: 'COMPLETED',
            sharePayload: context.command.payload.sharePayload,
            topologyHostStatus: statusSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.reconnectTopologyHost, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        if (topologyHost?.reconnect) {
            await topologyHost.reconnect()
        } else {
            await topologyHost?.getTopologyHostStatus?.()
        }
        const statusSnapshot = topologyHost?.getTopologyHostStatus
            ? await topologyHost.getTopologyHostStatus()
            : null
        return {
            status: 'COMPLETED',
            topologyHostStatus: statusSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.stopTopologyHost, async context => {
        const topologyHost = getAdminHostTools(context.localNodeId).topology
        await topologyHost?.stop?.()
        const statusSnapshot = topologyHost?.getTopologyHostStatus
            ? await topologyHost.getTopologyHostStatus()
            : null
        return {
            status: 'COMPLETED',
            topologyHostStatus: statusSnapshot ?? undefined,
        }
    }),
    onCommand(adminConsoleCommandDefinitions.switchServerSpace, async context => {
        const controlHost = getAdminHostTools(context.localNodeId).control
        await context.dispatchCommand(createCommand(
            transportRuntimeCommandDefinitions.setSelectedServerSpace,
            {
                selectedSpace: context.command.payload.selectedSpace,
            },
        ))
        await controlHost?.restartApp?.()
        const controlSnapshot = controlHost?.getSnapshot
            ? await controlHost.getSnapshot()
            : undefined
        return {
            status: 'COMPLETED',
            controlSnapshot,
        }
    }),
])
