import type {
    CommandId,
    ConnectionId,
    DispatchId,
    EnvelopeId,
    NodeId,
    ProjectionId,
    RequestId,
    RuntimeInstanceId,
    RuntimeIdKind,
    SessionId,
} from '../types/ids'

const KIND_PREFIX: Record<RuntimeIdKind, string> = {
    runtime: 'run',
    request: 'req',
    command: 'cmd',
    session: 'ses',
    node: 'nod',
    connection: 'con',
    envelope: 'env',
    dispatch: 'dsp',
    projection: 'prj',
}

const createIdPayload = (): string => {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export const createRuntimeId = <TId extends string>(kind: RuntimeIdKind): TId => {
    return `${KIND_PREFIX[kind]}_${createIdPayload()}` as TId
}

export const createRuntimeInstanceId = (): RuntimeInstanceId => createRuntimeId<RuntimeInstanceId>('runtime')
export const createRequestId = (): RequestId => createRuntimeId<RequestId>('request')
export const createCommandId = (): CommandId => createRuntimeId<CommandId>('command')
export const createSessionId = (): SessionId => createRuntimeId<SessionId>('session')
export const createNodeId = (): NodeId => createRuntimeId<NodeId>('node')
export const createConnectionId = (): ConnectionId => createRuntimeId<ConnectionId>('connection')
export const createEnvelopeId = (): EnvelopeId => createRuntimeId<EnvelopeId>('envelope')
export const createDispatchId = (): DispatchId => createRuntimeId<DispatchId>('dispatch')
export const createProjectionId = (): ProjectionId => createRuntimeId<ProjectionId>('projection')
