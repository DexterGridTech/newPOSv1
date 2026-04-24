import type {TdpTopicDataChangeItem} from '@next/kernel-base-tdp-sync-runtime-v2'
import type {
    OrganizationIamMasterDataRecord,
    OrganizationIamWireEnvelope,
} from '../types'
import {
    isOrganizationIamTopic,
    organizationIamProjectionKindByTopic,
} from './topics'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

export const decodeOrganizationIamChange = (
    topic: string,
    change: TdpTopicDataChangeItem,
): {record?: OrganizationIamMasterDataRecord; error?: string} => {
    if (!isOrganizationIamTopic(topic)) {
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
                envelope: {
                    schema_version: 1,
                    projection_kind: organizationIamProjectionKindByTopic[topic],
                    sandbox_id: '',
                    platform_id: '',
                    source_service: '',
                    source_event_id: '',
                    source_revision: change.revision ?? 0,
                    generated_at: change.occurredAt ?? new Date(0).toISOString(),
                    data: {},
                },
                data: {},
                tombstone: true,
            },
        }
    }
    if (!isRecord(change.payload)) {
        return {error: 'Missing retained-state payload'}
    }
    const envelope = change.payload as Partial<OrganizationIamWireEnvelope>
    if (envelope.schema_version !== 1) {
        return {error: `Unsupported schema_version ${String(envelope.schema_version)}`}
    }
    if (envelope.projection_kind !== organizationIamProjectionKindByTopic[topic]) {
        return {error: `Unexpected projection_kind ${String(envelope.projection_kind)}`}
    }
    if (!isRecord(envelope.data)) {
        return {error: 'Missing envelope.data'}
    }

    const typedEnvelope = envelope as OrganizationIamWireEnvelope
    return {
        record: {
            topic,
            itemKey: change.itemKey,
            scopeType: change.scopeType ?? 'UNKNOWN',
            scopeId: change.scopeId ?? 'UNKNOWN',
            revision: change.revision ?? typedEnvelope.source_revision,
            sourceReleaseId: change.sourceReleaseId,
            sourceEventId: typedEnvelope.source_event_id,
            sourceRevision: typedEnvelope.source_revision,
            occurredAt: change.occurredAt,
            updatedAt: Date.now(),
            envelope: typedEnvelope,
            data: typedEnvelope.data,
        },
    }
}
