import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {selectTdpActiveProjectionEntries, selectTdpResolvedProjectionByTopic} from '../selectors'
import {reconcileHotUpdateDesiredFromResolvedProjection} from './hotUpdateProjectionReducer'
import {TDP_HOT_UPDATE_TOPIC} from './hotUpdateTopic'
import type {
    HotUpdateCurrentFacts,
    TdpProjectionEnvelope,
    TdpTopicDataChangeItem,
    TdpTopicDataChangedPayload,
} from '../types'

export const TDP_SYSTEM_TOPIC_KEYS = {
    errorCatalog: 'error.message',
    parameterCatalog: 'system.parameter',
} as const

export interface TopicChangePublisherFingerprintV2 {
    byTopic: Record<string, string>
    resolvedByTopic: Record<string, Record<string, TdpProjectionEnvelope>>
}

export const toTopicFingerprintV2 = (entries: Record<string, TdpProjectionEnvelope>) =>
    Object.values(entries)
        .map(item => [
            item.itemKey,
            item.scopeType,
            item.scopeId,
            item.revision,
            item.operation,
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
                scopeType: previousEntry.scopeType,
                scopeId: previousEntry.scopeId,
                sourceReleaseId: previousEntry.sourceReleaseId ?? null,
                occurredAt: previousEntry.occurredAt,
                scopeMetadata: previousEntry.scopeMetadata,
            })
            continue
        }

        if (currentEntry && !previousEntry) {
            changes.push({
                operation: 'upsert',
                itemKey,
                payload: currentEntry.payload,
                revision: currentEntry.revision,
                scopeType: currentEntry.scopeType,
                scopeId: currentEntry.scopeId,
                sourceReleaseId: currentEntry.sourceReleaseId ?? null,
                occurredAt: currentEntry.occurredAt,
                scopeMetadata: currentEntry.scopeMetadata,
            })
            continue
        }

        if (!currentEntry || !previousEntry) {
            continue
        }

        const currentFingerprint = [
            currentEntry.revision,
            currentEntry.operation,
            currentEntry.scopeType,
            currentEntry.scopeId,
        ].join(':')
        const previousFingerprint = [
            previousEntry.revision,
            previousEntry.operation,
            previousEntry.scopeType,
            previousEntry.scopeId,
        ].join(':')
        if (currentFingerprint === previousFingerprint) {
            continue
        }

        changes.push({
            operation: 'upsert',
            itemKey,
            payload: currentEntry.payload,
            revision: currentEntry.revision,
            scopeType: currentEntry.scopeType,
            scopeId: currentEntry.scopeId,
            sourceReleaseId: currentEntry.sourceReleaseId ?? null,
            occurredAt: currentEntry.occurredAt,
            scopeMetadata: currentEntry.scopeMetadata,
        })
    }

    return changes.sort((left, right) => left.itemKey.localeCompare(right.itemKey))
}

export const createTopicChangePublisherFingerprintV2 = (): TopicChangePublisherFingerprintV2 => ({
    byTopic: {},
    resolvedByTopic: {},
})

/**
 * 设计意图：
 * TDP 本地保存的是全量 projection 仓库，但对外广播的是“按优先级计算后的生效变化”。
 * 这样业务包不需要知道 Platform/Project/Brand/Tenant/Store/Terminal 的覆盖规则，只消费当前真正生效的 upsert/delete。
 */
export const publishTopicDataChangesV2 = async (
    runtime: {
        getState(): unknown
        dispatchAction?(action: unknown): unknown
        dispatchCommand<TPayload = unknown>(command: ReturnType<typeof createCommand<TPayload>>): Promise<unknown>
    },
    fingerprintRef: TopicChangePublisherFingerprintV2,
    options: {
        currentFacts?: HotUpdateCurrentFacts
        topics?: readonly string[]
    } = {},
): Promise<{
    changedTopicCount: number
    changedTopics: string[]
}> => {
    const state = runtime.getState() as any
    const topics = options.topics == null
        ? new Set<string>([
            ...Object.values(selectTdpActiveProjectionEntries(state)).map(item => item.topic),
            ...Object.keys(fingerprintRef.byTopic),
        ])
        : new Set(options.topics)
    const changedTopics: string[] = []

    for (const topic of topics) {
        const resolved = selectTdpResolvedProjectionByTopic(state, topic)
        const fingerprint = toTopicFingerprintV2(resolved)
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

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, payload))
        changedTopics.push(topic)
    }

    if (
        changedTopics.includes(TDP_HOT_UPDATE_TOPIC)
        || changedTopics.includes('terminal.group.membership')
    ) {
        await reconcileHotUpdateDesiredFromResolvedProjection(runtime as any, {
            currentFacts: options.currentFacts,
        })
    }

    return {
        changedTopicCount: changedTopics.length,
        changedTopics,
    }
}
