import {
    createCommandId,
    createEnvelopeId,
    createRequestId,
    createSessionId,
    nowTimestampMs,
    type ErrorCatalogEntry,
    type ParameterCatalogEntry,
} from '@impos2/kernel-base-contracts'
import {runtimeShellCommandNames, type RuntimeModuleContext} from '@impos2/kernel-base-runtime-shell'
import {tdpSyncActorNames} from '../features/actors'
import {selectTdpResolvedProjectionByTopic} from '../selectors'
import {TDP_PROJECTION_STATE_KEY} from './stateKeys'
import type {
    TdpProjectionEnvelope,
    TdpTopicDataChangeItem,
    TdpTopicDataChangedPayload,
} from '../types'

export const TDP_SYSTEM_TOPIC_KEYS = {
    errorCatalog: 'error.message',
    parameterCatalog: 'system.parameter',
} as const

const toTopicFingerprint = (entries: Record<string, TdpProjectionEnvelope>) =>
    Object.values(entries)
        .map(item => [
            item.itemKey,
            item.scopeType,
            item.scopeId,
            item.revision,
            item.operation,
            JSON.stringify(item.payload),
        ].join(':'))
        .sort()
        .join('|')

const toChangeItems = (
    current: Record<string, TdpProjectionEnvelope>,
    previous: Record<string, TdpProjectionEnvelope>,
): TdpTopicDataChangeItem[] => {
    const itemKeys = new Set([
        ...Object.keys(current),
        ...Object.keys(previous),
    ])

    const changes: TdpTopicDataChangeItem[] = []

    for (const itemKey of itemKeys) {
        const currentEntry = current[itemKey]
        const previousEntry = previous[itemKey]

        if (!currentEntry && previousEntry) {
            changes.push({
                operation: 'delete',
                itemKey,
                revision: previousEntry.revision,
            })
            continue
        }

        if (currentEntry && !previousEntry) {
            changes.push({
                operation: 'upsert',
                itemKey,
                payload: currentEntry.payload,
                revision: currentEntry.revision,
            })
            continue
        }

        if (!currentEntry || !previousEntry) {
            continue
        }

        const currentFingerprint = `${currentEntry.revision}:${JSON.stringify(currentEntry.payload)}`
        const previousFingerprint = `${previousEntry.revision}:${JSON.stringify(previousEntry.payload)}`
        if (currentFingerprint === previousFingerprint) {
            continue
        }

        changes.push({
            operation: 'upsert',
            itemKey,
            payload: currentEntry.payload,
            revision: currentEntry.revision,
        })
    }

    return changes.sort((left, right) => left.itemKey.localeCompare(right.itemKey))
}

const toErrorCatalogEntry = (payload: Record<string, unknown>, itemKey: string): ErrorCatalogEntry | undefined => {
    const template = typeof payload.template === 'string'
        ? payload.template
        : typeof payload.message === 'string'
            ? payload.message
            : undefined
    if (!template) {
        return undefined
    }

    return {
        key: itemKey,
        template,
        updatedAt: nowTimestampMs(),
        source: 'remote',
    }
}

const toParameterCatalogEntry = (payload: Record<string, unknown>, itemKey: string): ParameterCatalogEntry => {
    return {
        key: itemKey,
        rawValue: payload.value ?? payload.rawValue,
        updatedAt: nowTimestampMs(),
        source: 'remote',
    }
}

const dispatchCatalogCommand = async (
    context: RuntimeModuleContext,
    commandName: string,
    payload: Record<string, unknown>,
) => {
    await context.handleRemoteDispatch(
        {
            envelopeId: createEnvelopeId(),
            requestId: createRequestId(),
            sessionId: createSessionId(),
            commandId: createCommandId(),
            parentCommandId: createCommandId(),
            ownerNodeId: context.localNodeId as any,
            sourceNodeId: context.localNodeId as any,
            targetNodeId: context.localNodeId as any,
            commandName,
            payload,
            context: {},
            sentAt: nowTimestampMs(),
        },
    )
}

export interface TopicChangePublisherFingerprint {
    byTopic: Record<string, string>
    resolvedByTopic: Record<string, Record<string, TdpProjectionEnvelope>>
}

export const createTopicChangePublisherFingerprint = (): TopicChangePublisherFingerprint => ({
    byTopic: {},
    resolvedByTopic: {},
})

const syncSystemTopicCatalogs = async (
    context: RuntimeModuleContext,
    payload: TdpTopicDataChangedPayload,
) => {
    if (payload.topic === TDP_SYSTEM_TOPIC_KEYS.errorCatalog) {
        const nextEntries = payload.changes
            .filter(item => item.operation === 'upsert' && item.payload)
            .map(item => toErrorCatalogEntry(item.payload!, item.itemKey))
            .filter((item): item is ErrorCatalogEntry => Boolean(item))
        const removeKeys = payload.changes
            .filter(item => item.operation === 'delete')
            .map(item => item.itemKey)

        if (nextEntries.length > 0) {
            await dispatchCatalogCommand(context, runtimeShellCommandNames.upsertErrorCatalogEntries, {
                entries: nextEntries,
            })
        }
        if (removeKeys.length > 0) {
            await dispatchCatalogCommand(context, runtimeShellCommandNames.removeErrorCatalogEntries, {
                keys: removeKeys,
            })
        }
        return
    }

    if (payload.topic === TDP_SYSTEM_TOPIC_KEYS.parameterCatalog) {
        const nextEntries = payload.changes
            .filter(item => item.operation === 'upsert' && item.payload)
            .map(item => toParameterCatalogEntry(item.payload!, item.itemKey))
        const removeKeys = payload.changes
            .filter(item => item.operation === 'delete')
            .map(item => item.itemKey)

        if (nextEntries.length > 0) {
            await dispatchCatalogCommand(context, runtimeShellCommandNames.upsertParameterCatalogEntries, {
                entries: nextEntries,
            })
        }
        if (removeKeys.length > 0) {
            await dispatchCatalogCommand(context, runtimeShellCommandNames.removeParameterCatalogEntries, {
                keys: removeKeys,
            })
        }
    }
}

export const publishTopicDataChanges = async (
    context: RuntimeModuleContext,
    fingerprintRef: TopicChangePublisherFingerprint,
) => {
    const state = context.getState()
    const projectionState = state[TDP_PROJECTION_STATE_KEY as keyof typeof state] as
        Record<string, TdpProjectionEnvelope> | undefined
    const topics = new Set<string>([
        ...Object.values(projectionState ?? {}).map(item => item.topic),
        ...Object.keys(fingerprintRef.byTopic),
    ])

    for (const topic of topics) {
        const resolved = selectTdpResolvedProjectionByTopic(state, topic)
        const fingerprint = toTopicFingerprint(resolved)
        const previousFingerprint = fingerprintRef.byTopic[topic] ?? ''

        if (fingerprint === previousFingerprint) {
            continue
        }

        const previousResolved = fingerprintRef.resolvedByTopic[topic] ?? {}
        const changes = toChangeItems(resolved, previousResolved)

        fingerprintRef.byTopic[topic] = fingerprint
        fingerprintRef.resolvedByTopic[topic] = resolved

        if (changes.length === 0) {
            continue
        }

        const payload: TdpTopicDataChangedPayload = {
            topic,
            changes,
        }

        await context.publishActor({
            actorName: tdpSyncActorNames.topicDataChanged,
            payload,
        })
        await syncSystemTopicCatalogs(context, payload)

        context.platformPorts.logger.info({
            category: 'projection.topic-change',
            event: 'tdp-topic-data-changed',
            message: 'publish resolved topic changes from TDP projection repository',
            data: {
                topic,
                changes,
            },
        })
    }
}
