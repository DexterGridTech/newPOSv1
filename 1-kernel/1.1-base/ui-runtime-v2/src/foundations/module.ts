import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {getUiScreenRegistry} from '../selectors'
import {createUiRuntimeActorDefinitions} from '../features/actors'
import {uiRuntimeV2CommandDefinitions} from '../features/commands'
import {uiRuntimeV2StateSlices} from '../features/slices'
import {uiRuntimeV2ErrorDefinitionList, uiRuntimeV2ParameterDefinitionList} from '../supports'

export const createUiRuntimeModuleV2 = (): KernelRuntimeModuleV2 => {
    const registry = getUiScreenRegistry()

    return {
        moduleName,
        packageVersion,
        stateSlices: uiRuntimeV2StateSlices,
        commandDefinitions: Object.values(uiRuntimeV2CommandDefinitions),
        actorDefinitions: createUiRuntimeActorDefinitions(registry),
        errorDefinitions: uiRuntimeV2ErrorDefinitionList,
        parameterDefinitions: uiRuntimeV2ParameterDefinitionList,
        install(context) {
            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'ui-runtime-v2-install',
                message: 'install ui runtime v2 contents',
                data: {
                    moduleName,
                    stateSlices: uiRuntimeV2StateSlices.map(slice => slice.name),
                    commandNames: Object.values(uiRuntimeV2CommandDefinitions).map(item => item.commandName),
                },
            })
        },
    }
}
