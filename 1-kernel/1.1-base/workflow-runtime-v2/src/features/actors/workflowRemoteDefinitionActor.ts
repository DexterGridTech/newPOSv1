import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {moduleName} from '../../moduleName'
import type {WorkflowRuntimeRegistryRecord} from '../../foundations/runtime'

const defineActor = createModuleActorFactory(moduleName)

export const createWorkflowRemoteDefinitionActorDefinitionV2 = (
    registry: WorkflowRuntimeRegistryRecord,
    remoteDefinitionTopicKey: string,
): ActorDefinition => defineActor('WorkflowRemoteDefinitionActor', [
    onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, context => {
        const payload = context.command.payload
        const acceptedTopics = new Set([
            remoteDefinitionTopicKey,
            'workflow.definition',
            'kernel.workflow.definition',
        ])
        if (!acceptedTopics.has(payload.topic)) {
            return {}
        }

        const definitions = payload.changes
            .filter(item => item.operation === 'upsert' && item.payload)
            .map(item => ({
                ...(item.payload as any),
                definitionId: (item.payload as any)?.definitionId ?? item.itemKey,
                updatedAt: (item.payload as any)?.updatedAt ?? item.revision,
            }))
        if (definitions.length > 0) {
            registry.registerDefinitions?.({
                definitions,
                source: 'remote',
            })
        }

        payload.changes
            .filter(item => item.operation === 'delete')
            .forEach(item => {
                registry.removeDefinition?.({
                    workflowKey: item.itemKey,
                    definitionId: item.itemKey,
                    source: 'remote',
                })
            })

        return {
            topic: payload.topic,
            changeCount: payload.changes.length,
        }
    }),
])
