import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {TransportServerConfig} from '../../types'
import {transportRuntimeCommandDefinitions} from '../commands'
import {transportRuntimeStateActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

const listSpaceNames = (config: TransportServerConfig): string[] =>
    config.spaces.map(space => space.name)

const assertKnownSpace = (
    config: TransportServerConfig,
    selectedSpace: string,
) => {
    if (config.spaces.some(space => space.name === selectedSpace)) {
        return
    }
    throw createAppError({
        key: `${moduleName}.server_space_not_found`,
        code: 'ERR_TRANSPORT_SERVER_SPACE_NOT_FOUND',
        name: 'Transport Server Space Not Found',
        defaultTemplate: `Server config space not found: ${selectedSpace}`,
        category: 'SYSTEM',
        severity: 'MEDIUM',
        moduleName,
    }, {
        details: {
            selectedSpace,
            availableSpaces: listSpaceNames(config),
        },
    })
}

export const createTransportServerSpaceActor = (
    config: TransportServerConfig,
): ActorDefinition => defineActor('TransportServerSpaceActor', [
    onCommand(transportRuntimeCommandDefinitions.initializeServerSpace, context => {
        const availableSpaces = listSpaceNames(context.command.payload.config)
        const selectedSpace = context.command.payload.selectedSpace ?? context.command.payload.config.selectedSpace
        assertKnownSpace(context.command.payload.config, selectedSpace)
        context.dispatchAction(transportRuntimeStateActions.replaceServerSpaceState({
            selectedSpace,
            availableSpaces,
        }))
        return {
            selectedSpace,
            availableSpaces,
        }
    }),
    onCommand(transportRuntimeCommandDefinitions.setSelectedServerSpace, context => {
        const selectedSpace = context.command.payload.selectedSpace
        assertKnownSpace(config, selectedSpace)
        context.dispatchAction(transportRuntimeStateActions.setSelectedServerSpace({selectedSpace}))
        return {
            selectedSpace,
            availableSpaces: listSpaceNames(config),
        }
    }),
])
