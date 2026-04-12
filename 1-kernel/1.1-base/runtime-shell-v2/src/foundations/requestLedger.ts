import {
    nowTimestampMs,
    type AppError,
    type CommandId,
    type CommandEventEnvelope,
    type RequestId,
    type RequestLifecycleSnapshot,
} from '@impos2/kernel-base-contracts'
import type {
    ActorExecutionResult,
    CommandAggregateResult,
    CommandAggregateStatus,
    DispatchedCommand,
    RequestListener,
    RequestQueryResult,
    RequestQueryStatus,
} from '../types'

interface MutableCommandRecord {
    command: DispatchedCommand
    startedAt: number
    completedAt?: number
    actorResults: ActorExecutionResult[]
    status: CommandAggregateStatus
}

interface MutableRequestRecord {
    requestId: RequestId
    rootCommandId: CommandId
    startedAt: number
    updatedAt: number
    status: RequestQueryStatus
    commands: MutableCommandRecord[]
}

const toRequestStatus = (commands: readonly MutableCommandRecord[]): RequestQueryStatus => {
    if (commands.some(command => command.status === 'TIMEOUT')) {
        return 'TIMEOUT'
    }
    if (commands.some(command => command.status === 'FAILED')) {
        return commands.some(command => command.status === 'COMPLETED' || command.status === 'PARTIAL_FAILED')
            ? 'PARTIAL_FAILED'
            : 'FAILED'
    }
    if (commands.some(command => command.status === 'PARTIAL_FAILED')) {
        return 'PARTIAL_FAILED'
    }
    if (commands.length > 0 && commands.every(command => command.completedAt != null && command.status === 'COMPLETED')) {
        return 'COMPLETED'
    }
    return 'RUNNING'
}

export const createRequestLedger = () => {
    const records = new Map<RequestId, MutableRequestRecord>()
    const requestListeners = new Map<RequestId, Set<RequestListener>>()
    const allListeners = new Set<RequestListener>()

    const toAggregate = (record: MutableCommandRecord): CommandAggregateResult => ({
        requestId: record.command.requestId,
        commandId: record.command.commandId,
        parentCommandId: record.command.parentCommandId,
        commandName: record.command.commandName,
        target: record.command.target,
        status: record.status,
        startedAt: record.startedAt,
        completedAt: record.completedAt ?? nowTimestampMs(),
        actorResults: [...record.actorResults],
    })

    const toQuery = (record: MutableRequestRecord): RequestQueryResult => ({
        requestId: record.requestId,
        rootCommandId: record.rootCommandId,
        status: record.status,
        startedAt: record.startedAt,
        updatedAt: record.updatedAt,
        commands: record.commands.map(toAggregate),
    })

    const emit = (requestId: RequestId) => {
        const record = records.get(requestId)
        if (!record) {
            return
        }
        const query = toQuery(record)
        requestListeners.get(requestId)?.forEach(listener => listener(query))
        allListeners.forEach(listener => listener(query))
    }

    const touch = (record: MutableRequestRecord) => {
        record.updatedAt = nowTimestampMs()
        record.status = toRequestStatus(record.commands)
        emit(record.requestId)
    }

    const getRecord = (requestId: RequestId) => {
        const record = records.get(requestId)
        if (!record) {
            throw new Error(`Request not found: ${String(requestId)}`)
        }
        return record
    }

    const getCommandRecord = (requestId: RequestId, commandId: CommandId) => {
        const record = getRecord(requestId)
        const commandRecord = record.commands.find(command => command.command.commandId === commandId)
        if (!commandRecord) {
            throw new Error(`Command not found: ${String(commandId)}`)
        }
        return commandRecord
    }

    return {
        registerCommand(command: DispatchedCommand) {
            const now = nowTimestampMs()
            let record = records.get(command.requestId)
            if (!record) {
                record = {
                    requestId: command.requestId,
                    rootCommandId: command.commandId,
                    startedAt: now,
                    updatedAt: now,
                    status: 'RUNNING',
                    commands: [],
                }
                records.set(command.requestId, record)
            }
            record.commands.push({
                command,
                startedAt: now,
                actorResults: [],
                status: 'COMPLETED',
            })
            touch(record)
        },
        registerMirroredCommand(input: {
            requestId: RequestId
            commandId: CommandId
            parentCommandId?: CommandId
            commandName: string
            target?: DispatchedCommand['target']
            routeContext?: DispatchedCommand['routeContext']
        }) {
            const now = nowTimestampMs()
            let record = records.get(input.requestId)
            if (!record) {
                record = {
                    requestId: input.requestId,
                    rootCommandId: input.commandId,
                    startedAt: now,
                    updatedAt: now,
                    status: 'RUNNING',
                    commands: [],
                }
                records.set(input.requestId, record)
            }
            const existing = record.commands.find(command => command.command.commandId === input.commandId)
            if (existing) {
                return
            }
            record.commands.push({
                command: {
                    runtimeId: 'runtime_shell_v2_mirror' as any,
                    requestId: input.requestId,
                    commandId: input.commandId,
                    parentCommandId: input.parentCommandId,
                    commandName: input.commandName,
                    payload: undefined,
                    target: input.target ?? 'peer',
                    routeContext: input.routeContext,
                    dispatchedAt: now,
                },
                startedAt: now,
                actorResults: [],
                status: 'COMPLETED',
            })
            touch(record)
        },
        markActorStarted(requestId: RequestId, commandId: CommandId, actorKey: string) {
            const commandRecord = getCommandRecord(requestId, commandId)
            if (!commandRecord.actorResults.some(result => result.actorKey === actorKey)) {
                commandRecord.actorResults.push({
                    actorKey,
                    status: 'TIMEOUT',
                    startedAt: nowTimestampMs(),
                })
            }
            touch(getRecord(requestId))
        },
        markActorCompleted(requestId: RequestId, commandId: CommandId, actorResult: ActorExecutionResult) {
            const commandRecord = getCommandRecord(requestId, commandId)
            const index = commandRecord.actorResults.findIndex(result => result.actorKey === actorResult.actorKey)
            if (index >= 0) {
                commandRecord.actorResults[index] = actorResult
            } else {
                commandRecord.actorResults.push(actorResult)
            }
            touch(getRecord(requestId))
        },
        completeCommand(
            requestId: RequestId,
            commandId: CommandId,
            status: CommandAggregateStatus,
            actorResults: readonly ActorExecutionResult[],
        ) {
            const commandRecord = getCommandRecord(requestId, commandId)
            commandRecord.status = status
            commandRecord.actorResults = [...actorResults]
            commandRecord.completedAt = nowTimestampMs()
            touch(getRecord(requestId))
            return toAggregate(commandRecord)
        },
        applyRemoteCommandEvent(envelope: CommandEventEnvelope) {
            const actorKey = 'runtime-shell-v2.remote-event'
            const record = records.get(envelope.requestId)
            const now = envelope.occurredAt ?? nowTimestampMs()
            if (!record) {
                return
            }
            const commandRecord = record.commands.find(command => command.command.commandId === envelope.commandId)
            if (!commandRecord) {
                return
            }
            if (envelope.eventType === 'accepted' || envelope.eventType === 'started') {
                const startedResult: ActorExecutionResult = {
                    actorKey,
                    status: 'TIMEOUT',
                    startedAt: now,
                }
                const existingIndex = commandRecord.actorResults.findIndex(result => result.actorKey === actorKey)
                if (existingIndex >= 0) {
                    commandRecord.actorResults[existingIndex] = {
                        ...commandRecord.actorResults[existingIndex],
                        ...startedResult,
                    }
                } else {
                    commandRecord.actorResults.push(startedResult)
                }
                touch(record)
                return
            }

            let actorError: AppError | undefined
            if (envelope.error) {
                actorError = {
                    name: envelope.error.key,
                    key: envelope.error.key,
                    code: envelope.error.code,
                    message: envelope.error.message,
                    category: 'SYSTEM',
                    severity: 'MEDIUM',
                    createdAt: now,
                    details: envelope.error.details,
                }
            }

            const completedResult: ActorExecutionResult = {
                actorKey,
                status: envelope.eventType === 'failed' ? 'FAILED' : 'COMPLETED',
                startedAt: commandRecord.startedAt,
                completedAt: now,
                result: envelope.eventType === 'completed' ? envelope.result : envelope.resultPatch,
                error: actorError,
            }
            const existingIndex = commandRecord.actorResults.findIndex(result => result.actorKey === actorKey)
            if (existingIndex >= 0) {
                commandRecord.actorResults[existingIndex] = completedResult
            } else {
                commandRecord.actorResults.push(completedResult)
            }
            commandRecord.status = envelope.eventType === 'failed' ? 'FAILED' : 'COMPLETED'
            commandRecord.completedAt = now
            touch(record)
        },
        applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot) {
            const commands: MutableCommandRecord[] = snapshot.commands.map(command => {
                const actorResults: ActorExecutionResult[] = []
                if (command.status === 'complete' || command.status === 'error') {
                    actorResults.push({
                        actorKey: 'runtime-shell-v2.snapshot',
                        status: command.status === 'error' ? 'FAILED' : 'COMPLETED',
                        startedAt: command.startedAt,
                        completedAt: command.updatedAt,
                        result: command.result,
                        error: command.error,
                    })
                }
                return {
                    command: {
                        runtimeId: 'runtime_shell_v2_snapshot' as any,
                        requestId: snapshot.requestId,
                        commandId: command.commandId,
                        parentCommandId: command.parentCommandId,
                        commandName: command.commandName,
                        payload: undefined,
                        target: command.targetNodeId === snapshot.ownerNodeId ? 'local' : 'peer',
                        dispatchedAt: command.startedAt ?? snapshot.startedAt,
                    },
                    startedAt: command.startedAt ?? snapshot.startedAt,
                    completedAt: command.status === 'complete' || command.status === 'error'
                        ? command.updatedAt
                        : undefined,
                    actorResults,
                    status: command.status === 'error'
                        ? 'FAILED'
                        : command.status === 'complete'
                            ? 'COMPLETED'
                            : 'COMPLETED',
                }
            })
            const record: MutableRequestRecord = {
                requestId: snapshot.requestId,
                rootCommandId: snapshot.rootCommandId,
                startedAt: snapshot.startedAt,
                updatedAt: snapshot.updatedAt,
                status: snapshot.status === 'complete'
                    ? 'COMPLETED'
                    : snapshot.status === 'error'
                        ? 'FAILED'
                        : 'RUNNING',
                commands,
            }
            records.set(snapshot.requestId, record)
            emit(snapshot.requestId)
        },
        query(requestId: RequestId) {
            const record = records.get(requestId)
            return record ? toQuery(record) : undefined
        },
        subscribeRequest(requestId: RequestId, listener: RequestListener) {
            const listeners = requestListeners.get(requestId) ?? new Set<RequestListener>()
            listeners.add(listener)
            requestListeners.set(requestId, listeners)
            const current = records.get(requestId)
            if (current) {
                listener(toQuery(current))
            }
            return () => {
                listeners.delete(listener)
            }
        },
        subscribeRequests(listener: RequestListener) {
            allListeners.add(listener)
            records.forEach(record => listener(toQuery(record)))
            return () => {
                allListeners.delete(listener)
            }
        },
    }
}
