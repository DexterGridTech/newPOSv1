import type {TdpTopicDataChangeItem} from '@next/kernel-base-tdp-sync-runtime-v2'
import type {
    BenefitLine,
    BenefitTemplate,
} from '@next/kernel-business-benefit-types'
import {
    benefitSessionTopics,
    isBenefitSessionTopic,
} from './topics'
import type {BenefitProjectionRecord} from '../types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isBenefitTemplate = (value: unknown): value is BenefitTemplate =>
    isRecord(value)
    && typeof value.templateKey === 'string'
    && typeof value.templateCode === 'string'
    && typeof value.version === 'number'

const isBenefitLine = (value: unknown): value is BenefitLine =>
    isRecord(value)
    && typeof value.lineKey === 'string'
    && typeof value.templateKey === 'string'
    && typeof value.status === 'string'

export const decodeBenefitProjectionChange = (
    topic: string,
    change: TdpTopicDataChangeItem,
): {record?: BenefitProjectionRecord; error?: string} => {
    if (!isBenefitSessionTopic(topic)) {
        return {error: `Unsupported topic ${topic}`}
    }

    if (change.operation === 'delete') {
        return {
            record: {
                topic,
                itemKey: change.itemKey,
                scopeType: change.scopeType ?? 'UNKNOWN',
                scopeId: change.scopeId ?? 'UNKNOWN',
                revision: change.revision ?? 0,
                sourceReleaseId: change.sourceReleaseId,
                occurredAt: change.occurredAt,
                updatedAt: Date.now(),
                tombstone: true,
            },
        }
    }

    if (!isRecord(change.payload)) {
        return {error: 'Missing benefit projection payload'}
    }

    if (topic === benefitSessionTopics.templateProfile && !isBenefitTemplate(change.payload)) {
        return {error: 'Invalid benefit template projection payload'}
    }
    if (topic === benefitSessionTopics.activityProfile && !isBenefitLine(change.payload)) {
        return {error: 'Invalid benefit activity projection payload'}
    }

    return {
        record: {
            topic,
            itemKey: change.itemKey,
            scopeType: change.scopeType ?? 'UNKNOWN',
            scopeId: change.scopeId ?? 'UNKNOWN',
            revision: change.revision ?? 0,
            sourceReleaseId: change.sourceReleaseId,
            occurredAt: change.occurredAt,
            updatedAt: Date.now(),
            data: change.payload,
        },
    }
}
