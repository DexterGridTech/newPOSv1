import type {RequestProjection} from '@impos2/kernel-base-contracts'
import type {OwnerLedgerRecord} from '../types/ownerLedger'

export const buildRequestProjection = (
    record: OwnerLedgerRecord,
): RequestProjection => {
    const nodes = Object.values(record.nodes)
    const hasError = nodes.some(node => node.status === 'error')
    const allTerminal = nodes.every(node => node.status === 'complete' || node.status === 'error')

    return {
        requestId: record.requestId,
        ownerNodeId: record.ownerNodeId,
        status: hasError ? 'error' : allTerminal ? 'complete' : 'started',
        startedAt: record.startedAt,
        updatedAt: record.updatedAt,
        resultsByCommand: Object.fromEntries(
            nodes
                .filter(node => node.result)
                .map(node => [node.commandId, node.result!]),
        ),
        mergedResults: Object.assign({}, ...nodes.map(node => node.result ?? {})),
        errorsByCommand: Object.fromEntries(
            nodes
                .filter(node => node.error)
                .map(node => [
                    node.commandId,
                    {
                        key: node.error!.key,
                        code: node.error!.code,
                        message: node.error!.message,
                    },
                ]),
        ),
        pendingCommandCount: nodes.filter(node => node.status !== 'complete' && node.status !== 'error').length,
    }
}
