import type {ActorDefinition, KernelRuntimeModuleV2} from '../types'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {runtimeShellV2CommandDefinitions, runtimeShellV2CommandNames} from '../features/commands'
import {runtimeShellV2StateActions, runtimeShellV2StateSlices} from '../features/slices'
import {onCommand} from './actor'

const runtimeShellV2ActorDefinitions: ActorDefinition[] = [
    {
        moduleName,
        actorName: 'RuntimeShellCatalogActor',
        handlers: [
            onCommand(runtimeShellV2CommandDefinitions.upsertErrorCatalogEntries, context => {
                const payload = context.command.payload
                    payload.entries.forEach(entry => {
                        context.dispatchAction(runtimeShellV2StateActions.setErrorCatalogEntry(entry as any))
                    })
                    return {
                        count: payload.entries.length,
                    }
                },
            ),
            onCommand(runtimeShellV2CommandDefinitions.removeErrorCatalogEntries, context => {
                const payload = context.command.payload
                    payload.keys.forEach(key => {
                        context.dispatchAction(runtimeShellV2StateActions.removeErrorCatalogEntry(key))
                    })
                    return {
                        count: payload.keys.length,
                    }
                },
            ),
            onCommand(runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries, context => {
                const payload = context.command.payload
                    payload.entries.forEach(entry => {
                        context.dispatchAction(runtimeShellV2StateActions.setParameterCatalogEntry(entry as any))
                    })
                    return {
                        count: payload.entries.length,
                    }
                },
            ),
            onCommand(runtimeShellV2CommandDefinitions.removeParameterCatalogEntries, context => {
                const payload = context.command.payload
                    payload.keys.forEach(key => {
                        context.dispatchAction(runtimeShellV2StateActions.removeParameterCatalogEntry(key))
                    })
                    return {
                        count: payload.keys.length,
                    }
                },
            ),
        ],
    },
]

export const createRuntimeShellInternalModuleV2 = (): KernelRuntimeModuleV2 => ({
    moduleName,
        packageVersion,
        stateSlices: runtimeShellV2StateSlices,
        commandDefinitions: Object.values(runtimeShellV2CommandDefinitions),
        actorDefinitions: runtimeShellV2ActorDefinitions,
})
