import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    type KernelRuntimeModuleV2,
    type RuntimeModuleContextV2,
    type RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {moduleName as runtimeReactModuleName, registerUiRendererParts} from '../../src'
import {
    runtimeReactScenarioDefinitions,
    runtimeReactScenarioParts,
} from './runtimeReactScenarioParts'

const scenarioModuleName = 'ui.base.runtime-react.test.scenario-module'

export const runtimeReactScenarioPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(runtimeReactScenarioParts))
    createRuntimeModuleLifecycleLogger({
        moduleName: scenarioModuleName,
        context,
    }).logPreSetup()
}

export const createRuntimeReactScenarioModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        moduleName: scenarioModuleName,
        packageVersion: '0.0.1',
        dependencies: [
            {moduleName: 'kernel.base.ui-runtime-v2'},
            {moduleName: runtimeReactModuleName},
        ],
        preSetup: runtimeReactScenarioPreSetup,
        async install(context: RuntimeModuleContextV2) {
            await context.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
                {
                    definitions: runtimeReactScenarioDefinitions,
                },
            ))
            await context.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.replaceScreen,
                {
                    definition: runtimeReactScenarioParts.home.definition,
                    props: {label: 'home-initial'},
                    source: `${scenarioModuleName}.install`,
                },
            ))
            await context.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.replaceScreen,
                {
                    definition: runtimeReactScenarioParts.secondary.definition,
                    source: `${scenarioModuleName}.install`,
                },
            ))
            await context.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.setUiVariables,
                {
                    'ui.base.runtime-react.test.message': 'bootstrapped',
                },
            ))

            createRuntimeModuleLifecycleLogger({
                moduleName: scenarioModuleName,
                context,
            }).logInstall({
                definitions: runtimeReactScenarioDefinitions.map(item => item.partKey),
            })
        },
    })
