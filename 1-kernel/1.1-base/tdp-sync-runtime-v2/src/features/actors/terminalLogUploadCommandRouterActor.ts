import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {terminalLogUploadRuntimeV2CommandDefinitions} from '@impos2/kernel-base-terminal-log-upload-runtime-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
    const value = record[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const readHeaders = (value: unknown): Record<string, string> | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
    }
    const headers: Record<string, string> = {}
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
        if (typeof raw === 'string') {
            headers[key] = raw
        }
    })
    return Object.keys(headers).length > 0 ? headers : undefined
}

export const createTdpTerminalLogUploadCommandRouterActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpTerminalLogUploadCommandRouterActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.tdpCommandDelivered, async context => {
            const payload = context.command.payload.payload
            const commandType = readString(payload, 'commandType')
            if (commandType !== 'UPLOAD_TERMINAL_LOGS') {
                return {routed: false}
            }

            const logDate = readString(payload, 'logDate')
            const uploadUrl = readString(payload, 'uploadUrl')
            if (!logDate || !uploadUrl) {
                return {routed: false, reason: 'invalid-payload'}
            }

            await context.dispatchCommand(createCommand(
                terminalLogUploadRuntimeV2CommandDefinitions.uploadTerminalLogs,
                {
                    commandId: context.command.payload.commandId,
                    instanceId: readString(payload, 'instanceId'),
                    releaseId: readString(payload, 'releaseId'),
                    sourceReleaseId: context.command.payload.sourceReleaseId,
                    logDate,
                    uploadUrl,
                    overwrite: payload.overwrite !== false,
                    headers: readHeaders(payload.headers),
                    metadata: {
                        ...(payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
                            ? payload.metadata as Record<string, unknown>
                            : {}),
                        topic: context.command.payload.topic,
                        terminalId: context.command.payload.terminalId,
                        remoteCommandId: context.command.payload.commandId,
                    },
                },
            ))

            return {routed: true}
        }),
    ],
)
