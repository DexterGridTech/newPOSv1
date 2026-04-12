import {createAppError, nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    RequestId,
    RequestLifecycleSnapshot,
    SessionId,
} from '@impos2/kernel-base-contracts'
import type {
    OwnerCommandNode,
    OwnerLedger,
    OwnerLedgerRecord,
} from '../types/ownerLedger'
import type {RegisterRootRequestInput} from '../types/runtime'
import {topologyRuntimeErrorDefinitions} from '../supports'

const getRecordOrThrow = (
    records: Map<RequestId, OwnerLedgerRecord>,
    requestId: RequestId,
): OwnerLedgerRecord => {
    const record = records.get(requestId)
    if (!record) {
        throw createAppError(topologyRuntimeErrorDefinitions.requestNotFound, {args: {requestId}})
    }
    return record
}

const getNodeOrThrow = (
    record: OwnerLedgerRecord,
    commandId: string,
): OwnerCommandNode => {
    const node = record.nodes[commandId]
    if (!node) {
        throw createAppError(topologyRuntimeErrorDefinitions.commandNotFound, {
            args: {commandId},
            context: {
                requestId: record.requestId,
                commandId: commandId as any,
            },
        })
    }
    return node
}

const cloneRecord = (record: OwnerLedgerRecord): OwnerLedgerRecord => {
    return {
        ...record,
        nodes: Object.fromEntries(
            Object.entries(record.nodes).map(([commandId, node]) => [
                commandId,
                {
                    ...node,
                    result: node.result ? {...node.result} : undefined,
                    error: node.error ? {...node.error} : undefined,
                },
            ]),
        ),
    }
}

const buildSnapshotStatus = (
    record: OwnerLedgerRecord,
): RequestLifecycleSnapshot['status'] => {
    const nodes = Object.values(record.nodes)
    if (nodes.some(node => node.status === 'error')) {
        return 'error'
    }
    if (nodes.every(node => node.status === 'complete' || node.status === 'error')) {
        return 'complete'
    }
    return 'started'
}

const buildCommandResults = (
    record: OwnerLedgerRecord,
): RequestLifecycleSnapshot['commandResults'] => {
    return Object.values(record.nodes)
        .filter(node => node.result || node.error)
        .map(node => ({
            commandId: node.commandId,
            result: node.result ? {...node.result} : undefined,
            error: node.error ? {...node.error} : undefined,
            completedAt: node.status === 'complete' ? node.updatedAt : undefined,
            erroredAt: node.status === 'error' ? node.updatedAt : undefined,
        }))
}

const buildRequestLifecycleSnapshot = (
    record: OwnerLedgerRecord,
    sessionId?: SessionId,
): RequestLifecycleSnapshot => {
    const clonedRecord = cloneRecord(record)
    const commands = Object.values(clonedRecord.nodes).map(node => ({
        commandId: node.commandId,
        parentCommandId: node.parentCommandId,
        ownerNodeId: node.ownerNodeId,
        sourceNodeId: node.sourceNodeId,
        targetNodeId: node.targetNodeId,
        commandName: node.commandName,
        status: node.status,
        result: node.result ? {...node.result} : undefined,
        error: node.error ? {...node.error} : undefined,
        startedAt: node.startedAt,
        updatedAt: node.updatedAt,
    }))

    return {
        requestId: clonedRecord.requestId,
        ownerNodeId: clonedRecord.ownerNodeId,
        rootCommandId: clonedRecord.rootCommandId,
        sessionId,
        status: buildSnapshotStatus(clonedRecord),
        startedAt: clonedRecord.startedAt,
        updatedAt: clonedRecord.updatedAt,
        commands,
        commandResults: buildCommandResults(clonedRecord),
    }
}

export const createOwnerLedger = (): OwnerLedger => {
    const records = new Map<RequestId, OwnerLedgerRecord>()

    return {
        registerRootRequest(input: RegisterRootRequestInput): OwnerLedgerRecord {
            if (records.has(input.requestId)) {
                throw createAppError(topologyRuntimeErrorDefinitions.requestAlreadyRegistered, {
                    args: {requestId: input.requestId},
                    context: {
                        requestId: input.requestId,
                        commandId: input.rootCommandId,
                        nodeId: input.ownerNodeId,
                    },
                })
            }

            const startedAt = input.startedAt ?? nowTimestampMs()
            const rootNode: OwnerCommandNode = {
                commandId: input.rootCommandId,
                requestId: input.requestId,
                ownerNodeId: input.ownerNodeId,
                sourceNodeId: input.sourceNodeId,
                targetNodeId: input.ownerNodeId,
                commandName: input.commandName,
                status: 'started',
                startedAt,
                updatedAt: startedAt,
            }

            const record: OwnerLedgerRecord = {
                requestId: input.requestId,
                ownerNodeId: input.ownerNodeId,
                rootCommandId: input.rootCommandId,
                startedAt,
                updatedAt: startedAt,
                nodes: {
                    [input.rootCommandId]: rootNode,
                },
            }

            records.set(input.requestId, record)
            return cloneRecord(record)
        },

        registerChildDispatch(envelope: CommandDispatchEnvelope): OwnerLedgerRecord {
            const record = getRecordOrThrow(records, envelope.requestId)

            if (envelope.parentCommandId && !record.nodes[envelope.parentCommandId]) {
                throw createAppError(topologyRuntimeErrorDefinitions.commandParentNotFound, {
                    args: {parentCommandId: envelope.parentCommandId},
                    context: {
                        requestId: envelope.requestId,
                        commandId: envelope.commandId,
                        nodeId: envelope.ownerNodeId,
                    },
                })
            }

            const nextNode: OwnerCommandNode = {
                commandId: envelope.commandId,
                requestId: envelope.requestId,
                ownerNodeId: envelope.ownerNodeId,
                sourceNodeId: envelope.sourceNodeId,
                targetNodeId: envelope.targetNodeId,
                commandName: envelope.commandName,
                parentCommandId: envelope.parentCommandId,
                status: 'dispatched',
                updatedAt: envelope.sentAt,
            }

            record.nodes[envelope.commandId] = nextNode
            record.updatedAt = envelope.sentAt

            return cloneRecord(record)
        },

        applyCommandEvent(envelope: CommandEventEnvelope): OwnerLedgerRecord {
            const record = getRecordOrThrow(records, envelope.requestId)
            const node = getNodeOrThrow(record, envelope.commandId)

            node.updatedAt = envelope.occurredAt

            if (envelope.eventType === 'accepted') {
                node.status = 'accepted'
            } else if (envelope.eventType === 'started') {
                node.status = 'started'
                node.startedAt = envelope.occurredAt
            } else if (envelope.eventType === 'resultPatch') {
                node.result = {
                    ...node.result,
                    ...(envelope.resultPatch ?? {}),
                }
            } else if (envelope.eventType === 'completed') {
                node.status = 'complete'
                node.result = envelope.result ?? node.result
            } else if (envelope.eventType === 'failed') {
                node.status = 'error'
                node.error = createAppError(topologyRuntimeErrorDefinitions.remoteCommandFailed, {
                    args: {
                        message: envelope.error?.message ?? 'remote command failed',
                    },
                    context: {
                        requestId: envelope.requestId,
                        commandId: envelope.commandId,
                        nodeId: envelope.ownerNodeId,
                    },
                    details: envelope.error,
                })
            }

            record.updatedAt = envelope.occurredAt
            return cloneRecord(record)
        },

        exportRequestLifecycleSnapshot(requestId, sessionId) {
            const record = records.get(requestId)
            return record ? buildRequestLifecycleSnapshot(record, sessionId) : undefined
        },

        applyRequestLifecycleSnapshot(snapshot) {
            const nodes = Object.fromEntries(
                snapshot.commands.map(command => [
                    command.commandId,
                    {
                        commandId: command.commandId,
                        requestId: snapshot.requestId,
                        ownerNodeId: command.ownerNodeId,
                        sourceNodeId: command.sourceNodeId,
                        targetNodeId: command.targetNodeId,
                        commandName: command.commandName,
                        parentCommandId: command.parentCommandId,
                        status: command.status,
                        result: command.result ? {...command.result} : undefined,
                        error: command.error ? {...command.error} : undefined,
                        startedAt: command.startedAt,
                        updatedAt: command.updatedAt,
                    },
                ]),
            )

            const record: OwnerLedgerRecord = {
                requestId: snapshot.requestId,
                ownerNodeId: snapshot.ownerNodeId,
                rootCommandId: snapshot.rootCommandId,
                startedAt: snapshot.startedAt,
                updatedAt: snapshot.updatedAt,
                nodes,
            }

            records.set(snapshot.requestId, record)
            return cloneRecord(record)
        },

        getRequestRecord(requestId) {
            const record = records.get(requestId)
            return record ? cloneRecord(record) : undefined
        },

        listRequestIds(input) {
            return [...records.values()]
                .filter(record => {
                    if (!input?.peerNodeId) {
                        return true
                    }
                    return Object.values(record.nodes).some(node => {
                        return node.sourceNodeId === input.peerNodeId || node.targetNodeId === input.peerNodeId
                    })
                })
                .map(record => record.requestId)
        },

        hasTrackedCommand(requestId, commandId) {
            const record = records.get(requestId)
            return Boolean(record?.nodes[commandId])
        },

        listRecords() {
            return [...records.values()].map(cloneRecord)
        },
    }
}
