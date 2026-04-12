import {createCommand, onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {ErrorCatalogEntry, ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {TDP_SYSTEM_TOPIC_KEYS} from '../../foundations/topicChangePublisher'

const toErrorCatalogEntry = (
    payload: Record<string, unknown>,
    itemKey: string,
): ErrorCatalogEntry | undefined => {
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
        updatedAt: payload.updatedAt as any ?? Date.now(),
        source: 'remote',
    }
}

const toParameterCatalogEntry = (
    payload: Record<string, unknown>,
    itemKey: string,
): ParameterCatalogEntry => ({
    key: itemKey,
    rawValue: payload.value ?? payload.rawValue,
    updatedAt: payload.updatedAt as any ?? Date.now(),
    source: 'remote',
})

export const createTdpSystemCatalogBridgeActorDefinitionV2 = (): ActorDefinition => ({
    moduleName,
    actorName: 'TdpSystemCatalogBridgeActor',
    handlers: [
        onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, async context => {
                const payload = context.command.payload

                if (payload.topic === TDP_SYSTEM_TOPIC_KEYS.errorCatalog) {
                    const nextEntries = payload.changes
                        .filter(item => item.operation === 'upsert' && item.payload)
                        .map(item => toErrorCatalogEntry(item.payload!, item.itemKey))
                        .filter((item): item is ErrorCatalogEntry => Boolean(item))
                    const removeKeys = payload.changes
                        .filter(item => item.operation === 'delete')
                        .map(item => item.itemKey)

                    if (nextEntries.length > 0) {
                        await context.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.upsertErrorCatalogEntries, {
                            entries: nextEntries,
                        }))
                    }
                    if (removeKeys.length > 0) {
                        await context.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.removeErrorCatalogEntries, {
                            keys: removeKeys,
                        }))
                    }
                    return {
                        topic: payload.topic,
                        upsertCount: nextEntries.length,
                        removeCount: removeKeys.length,
                    }
                }

                if (payload.topic === TDP_SYSTEM_TOPIC_KEYS.parameterCatalog) {
                    const nextEntries = payload.changes
                        .filter(item => item.operation === 'upsert' && item.payload)
                        .map(item => toParameterCatalogEntry(item.payload!, item.itemKey))
                    const removeKeys = payload.changes
                        .filter(item => item.operation === 'delete')
                        .map(item => item.itemKey)

                    if (nextEntries.length > 0) {
                        await context.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries, {
                            entries: nextEntries,
                        }))
                    }
                    if (removeKeys.length > 0) {
                        await context.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.removeParameterCatalogEntries, {
                            keys: removeKeys,
                        }))
                    }
                    return {
                        topic: payload.topic,
                        upsertCount: nextEntries.length,
                        removeCount: removeKeys.length,
                    }
                }

                return {}
            },
        ),
    ],
})
