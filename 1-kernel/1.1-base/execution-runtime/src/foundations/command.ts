import type {
    CommandId,
    CommandRouteContext,
    RequestId,
    SessionId,
} from '@impos2/kernel-base-contracts'
import {INTERNAL_REQUEST_ID, INTERNAL_SESSION_ID} from '@impos2/kernel-base-contracts'
import type {ExecutionCommand} from '../types/execution'

export interface CreateExecutionCommandInput<TPayload = unknown> {
    commandId: CommandId
    requestId: RequestId
    sessionId?: SessionId
    commandName: string
    payload: TPayload
    context?: CommandRouteContext
    parentCommandId?: CommandId
    internal?: boolean
}

export const createExecutionCommand = <TPayload = unknown>(
    input: CreateExecutionCommandInput<TPayload>,
): ExecutionCommand<TPayload> => {
    return {
        ...input,
    }
}

export const createInternalExecutionCommand = <TPayload = unknown>(
    input: Omit<CreateExecutionCommandInput<TPayload>, 'internal' | 'requestId' | 'sessionId'> & {
        requestId?: RequestId
        sessionId?: SessionId
    },
): ExecutionCommand<TPayload> => {
    return createExecutionCommand({
        ...input,
        requestId: input.requestId ?? INTERNAL_REQUEST_ID,
        sessionId: input.sessionId ?? INTERNAL_SESSION_ID,
        internal: true,
    })
}
