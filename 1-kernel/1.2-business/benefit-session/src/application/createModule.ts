import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createFetchHttpTransport,
    createHttpRuntime,
    type HttpRuntime,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import {evaluateBenefitRequest} from '@next/kernel-business-benefit-calculation'
import {moduleName} from '../moduleName'
import {createBenefitSessionActorDefinitions} from '../features/actors'
import type {BenefitCenterPortRef, CreateBenefitSessionModuleInput} from '../types'
import {createBenefitSessionHttpService} from '../foundations/httpService'
import {benefitSessionModuleManifest} from './moduleManifest'

const DEFAULT_MOCK_TERMINAL_PLATFORM_BASE_URL = 'http://127.0.0.1:5810'
const DEFAULT_MOCK_TERMINAL_PLATFORM_ADDRESS_NAME = 'local-default'

export const createDefaultBenefitSessionHttpRuntime = (
    context: RuntimeModuleContextV2,
): HttpRuntime => createHttpRuntime({
    logger: context.platformPorts.logger.scope({
        moduleName,
        subsystem: 'transport.http',
        component: 'BenefitSessionHttpRuntime',
    }),
    transport: createFetchHttpTransport(),
    servers: [
        {
            serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
            addresses: [
                {
                    addressName: DEFAULT_MOCK_TERMINAL_PLATFORM_ADDRESS_NAME,
                    baseUrl: DEFAULT_MOCK_TERMINAL_PLATFORM_BASE_URL,
                },
            ],
        },
    ],
})

export const benefitSessionPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createBenefitSessionModule = (
    input: CreateBenefitSessionModuleInput = {},
): KernelRuntimeModuleV2 => {
    if (input.benefitCenterPort && input.assembly) {
        throw new Error('BENEFIT_SESSION_BENEFIT_CENTER_PORT_CONFLICTS_WITH_ASSEMBLY_HTTP_RUNTIME')
    }

    const benefitCenterPortRef: BenefitCenterPortRef = {
        current: input.benefitCenterPort,
    }
    const calculator = input.calculator ?? {evaluateBenefitRequest}

    return defineKernelRuntimeModuleV2({
        ...benefitSessionModuleManifest,
        actorDefinitions: createBenefitSessionActorDefinitions(benefitCenterPortRef, calculator),
        preSetup: benefitSessionPreSetup,
        install(context: RuntimeModuleContextV2) {
            if (!benefitCenterPortRef.current) {
                const httpRuntime = input.assembly?.createHttpRuntime(context)
                    ?? createDefaultBenefitSessionHttpRuntime(context)
                benefitCenterPortRef.current = createBenefitSessionHttpService(httpRuntime)
            }

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: benefitSessionModuleManifest.stateSliceNames,
                commandNames: benefitSessionModuleManifest.commandNames,
            })
        },
    })
}

export const benefitSessionModuleDescriptor =
    deriveKernelRuntimeModuleDescriptorV2(createBenefitSessionModule)
