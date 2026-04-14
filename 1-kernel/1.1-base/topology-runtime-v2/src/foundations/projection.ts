import type {AppError, NodeId, RequestProjection} from '@impos2/kernel-base-contracts'
import type {RequestQueryResult} from '@impos2/kernel-base-runtime-shell-v2'

const toErrorView = (error: AppError | undefined): {key: string; code: string; message: string} | undefined => {
    if (!error) {
        return undefined
    }

    return {
        key: error.key,
        code: error.code,
        message: error.message,
    }
}

export const buildRequestProjectionFromQuery = (
    query: RequestQueryResult,
    ownerNodeId: NodeId,
): RequestProjection => {
    const resultsByCommand: RequestProjection['resultsByCommand'] = {}
    const errorsByCommand: RequestProjection['errorsByCommand'] = {}
    let mergedResults: Record<string, unknown> = {}
    let pendingCommandCount = 0

    query.commands.forEach(command => {
        const actorResultWithValue = command.actorResults.find(item => item.result !== undefined)
        const actorResultWithError = command.actorResults.find(item => item.error)

        if (command.completedAt == null) {
            pendingCommandCount += 1
        }

        if (actorResultWithValue?.result && typeof actorResultWithValue.result === 'object') {
            resultsByCommand[command.commandId] = actorResultWithValue.result as Record<string, unknown>
            mergedResults = {
                ...mergedResults,
                ...resultsByCommand[command.commandId],
            }
        }

        const errorView = toErrorView(actorResultWithError?.error)
        if (errorView) {
            errorsByCommand[command.commandId] = errorView
        }
    })

    return {
        requestId: query.requestId,
        ownerNodeId,
        status: query.status === 'COMPLETED'
            ? 'complete'
            : query.status === 'FAILED' || query.status === 'PARTIAL_FAILED' || query.status === 'TIMEOUT'
                ? 'error'
                : 'started',
        startedAt: query.startedAt,
        updatedAt: query.updatedAt,
        resultsByCommand,
        mergedResults,
        errorsByCommand,
        pendingCommandCount,
    }
}
