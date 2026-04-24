import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {uiRuntimeV2CommandDefinitions} from '../commands'
import type {UiRuntimeScreenRegistry} from '../../types'

const defineActor = createModuleActorFactory(moduleName)

export const createUiRuntimeScreenRegistryActorDefinition = (
    registry: UiRuntimeScreenRegistry,
): ActorDefinition => defineActor('UiRuntimeScreenRegistryActor', [
    onCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, context => {
            registry.registerMany(context.command.payload.definitions)
            return {
                registeredCount: context.command.payload.definitions.length,
            }
        }),
])
