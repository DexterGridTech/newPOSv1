import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {uiRuntimeV2CommandDefinitions} from '../commands'
import type {UiRuntimeScreenRegistry} from '../../types'

export const createUiRuntimeScreenRegistryActorDefinition = (
    registry: UiRuntimeScreenRegistry,
): ActorDefinition => ({
    moduleName,
    actorName: 'UiRuntimeScreenRegistryActor',
    handlers: [
        onCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, context => {
            registry.registerMany(context.command.payload.definitions)
            return {
                registeredCount: context.command.payload.definitions.length,
            }
        }),
    ],
})
