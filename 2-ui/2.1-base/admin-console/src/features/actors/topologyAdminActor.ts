import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
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

const readNumber = (
    record: Record<string, unknown>,
    key: string,
): number | undefined => {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const readServerAddress = (
    record: Record<string, unknown>,
    key: string,
): readonly {address: string}[] | undefined => {
    const value = record[key]
    if (
        Array.isArray(value)
        && value.every(item => item && typeof item === 'object' && typeof (item as {address?: unknown}).address === 'string')
    ) {
        return value as readonly {address: string}[]
    }
    return undefined
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

const normalizeSharePayloadFromBarcode = (
    barcode: string,
): AdminTopologySharePayload => {
    const parsed = JSON.parse(barcode) as unknown
    const record = toRecord(parsed)
    if (!record) {
        throw new Error('二维码内容不是 topology 分享 JSON')
    }
    const payload = {
        formatVersion: readString(record, 'formatVersion')
            ?? readString(record, 'FORMATVERSION')
            ?? readString(record, 'v'),
        deviceId: readString(record, 'deviceId')
            ?? readString(record, 'DEVICEID')
            ?? readString(record, 'd'),
        masterNodeId: readString(record, 'masterNodeId')
            ?? readString(record, 'MASTERNODEID')
            ?? readString(record, 'n'),
        exportedAt: readNumber(record, 'exportedAt')
            ?? readNumber(record, 'EXPORTEDAT')
            ?? readNumber(record, 't'),
        wsUrl: readString(record, 'wsUrl')
            ?? readString(record, 'WSURL')
            ?? readString(record, 'w'),
        httpBaseUrl: readString(record, 'httpBaseUrl')
            ?? readString(record, 'HTTPBASEURL')
            ?? readString(record, 'h'),
        serverAddress: readServerAddress(record, 'serverAddress')
            ?? readServerAddress(record, 'SERVERADDRESS')
            ?? readServerAddress(record, 's'),
    } satisfies Partial<AdminTopologySharePayload>
    if (
        payload.formatVersion !== '2026.04'
        || typeof payload.deviceId !== 'string'
        || typeof payload.masterNodeId !== 'string'
        || (!payload.wsUrl && !payload.httpBaseUrl)
    ) {
        throw new Error('二维码中的 topology 分享信息不完整')
    }
    return payload as AdminTopologySharePayload
}

const getErrorMessage = (error: unknown): string =>
    error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : 'unknown error'

export const createAdminTopologyActor = (): ActorDefinition => defineActor('AdminTopologyActor', [
    onCommand(adminConsoleCommandDefinitions.scanAndImportTopologyMaster, async context => {
        const topologyHost = getAdminHostTools().topology
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
        const sharePayload = normalizeSharePayloadFromBarcode(barcodeResult.barcode)
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
])
