import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {createTdpSyncActorDefinitionsV2} from '../features/actors'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {tdpSyncV2StateSlices} from '../features/slices'
import {createTopicChangePublisherFingerprintV2} from './topicChangePublisher'
import {
    createDefaultTdpSyncHttpRuntimeV2,
    installTdpSessionConnectionRuntimeV2,
} from './sessionConnectionRuntime'
import {createTdpSyncHttpServiceV2} from './httpService'
import {
    tdpSyncV2ErrorDefinitionList,
    tdpSyncV2ParameterDefinitionList,
} from '../supports'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../types'

export const createTdpSyncRuntimeModuleV2 = (
    input: CreateTdpSyncRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const fingerprintRef = createTopicChangePublisherFingerprintV2()
    const connectionRuntimeRef = {}

    return {
        moduleName,
        packageVersion,
        dependencies: [
            {
                moduleName: 'kernel.base.tcp-control-runtime-v2',
            },
        ],
        stateSlices: tdpSyncV2StateSlices,
        commandDefinitions: Object.values(tdpSyncV2CommandDefinitions),
        actorDefinitions: createTdpSyncActorDefinitionsV2(
            fingerprintRef,
            connectionRuntimeRef,
            input,
        ),
        errorDefinitions: tdpSyncV2ErrorDefinitionList,
        parameterDefinitions: tdpSyncV2ParameterDefinitionList,
        install(context) {
            createTdpSyncHttpServiceV2(
                input.assembly?.createHttpRuntime(context) ?? createDefaultTdpSyncHttpRuntimeV2(context),
            )
            installTdpSessionConnectionRuntimeV2({
                context,
                moduleInput: input,
                connectionRuntimeRef,
            })
            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'tdp-sync-runtime-v2-install',
                message: 'install tdp sync runtime v2 contents',
                data: {
                    moduleName,
                    stateSlices: tdpSyncV2StateSlices.map(slice => slice.name),
                    commandNames: Object.values(tdpSyncV2CommandDefinitions).map(item => item.commandName),
                    hasAssembly: Boolean(input.assembly),
                },
            })
        },
    }
}
