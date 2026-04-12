import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const runtimeShellErrorDefinitions = {
    executeFailed: {
        key: 'kernel.base.runtime-shell.execute_failed',
        name: 'Kernel Runtime Execute Failed',
        defaultTemplate: 'Kernel runtime failed to execute ${commandName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    actorPublishFailed: {
        key: 'kernel.base.runtime-shell.actor_publish_failed',
        name: 'Kernel Runtime Actor Publish Failed',
        defaultTemplate: 'Kernel runtime failed to publish actor ${actorName}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const runtimeShellErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    runtimeShellErrorDefinitions,
)
