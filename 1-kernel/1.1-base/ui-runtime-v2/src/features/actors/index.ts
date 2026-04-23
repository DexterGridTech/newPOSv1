import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import type {UiRuntimeScreenRegistry} from '../../types'
import {createUiRuntimeScreenRegistryActorDefinition} from './screenRegistryActor'
import {createUiRuntimeScreenRuntimeActorDefinition} from './screenRuntimeActor'
import {createUiRuntimeOverlayRuntimeActorDefinition} from './overlayRuntimeActor'
import {createUiRuntimeVariableRuntimeActorDefinition} from './uiVariableRuntimeActor'

export * from './screenRegistryActor'
export * from './screenRuntimeActor'
export * from './overlayRuntimeActor'
export * from './uiVariableRuntimeActor'

export const createUiRuntimeActorDefinitions = (
    registry: UiRuntimeScreenRegistry,
): ActorDefinition[] => [
    createUiRuntimeScreenRegistryActorDefinition(registry),
    createUiRuntimeScreenRuntimeActorDefinition(),
    createUiRuntimeOverlayRuntimeActorDefinition(),
    createUiRuntimeVariableRuntimeActorDefinition(),
]
