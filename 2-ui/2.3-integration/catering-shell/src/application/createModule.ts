import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {selectTcpIdentitySnapshot} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    moduleName as runtimeReactModuleName,
    registerUiRendererParts,
} from '@next/ui-base-runtime-react'
import {moduleName as inputRuntimeModuleName} from '@next/ui-base-input-runtime'
import {moduleName as adminConsoleModuleName} from '@next/ui-base-admin-console'
import {moduleName as terminalConsoleModuleName} from '@next/ui-base-terminal-console'
import {moduleName as masterDataWorkbenchModuleName} from '@next/ui-business-catering-master-data-workbench'
import {createModule as createMasterDataWorkbenchModule} from '@next/ui-business-catering-master-data-workbench'
import {createOrganizationIamMasterDataModule} from '@next/kernel-business-organization-iam-master-data'
import {createCateringProductMasterDataModule} from '@next/kernel-business-catering-product-master-data'
import {createCateringStoreOperatingMasterDataModule} from '@next/kernel-business-catering-store-operating-master-data'
import {moduleName} from '../moduleName'
import {createCateringShellActorDefinitions} from '../features'
import {cateringShellScreenDefinitions, cateringShellScreenParts} from '../foundations'
import {replaceCateringShellRootScreen} from '../supports/rootScreenRouter'
import {cateringShellModuleManifest} from './moduleManifest'

export const cateringShellPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(cateringShellScreenParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createCateringBusinessModules = (): readonly KernelRuntimeModuleV2[] => [
    createOrganizationIamMasterDataModule(),
    createCateringProductMasterDataModule(),
    createCateringStoreOperatingMasterDataModule(),
    createMasterDataWorkbenchModule(),
]

export const createModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...cateringShellModuleManifest,
        dependencies: [
            {moduleName: 'kernel.base.ui-runtime-v2'},
            {moduleName: 'kernel.base.tcp-control-runtime-v2'},
            {moduleName: runtimeReactModuleName},
            {moduleName: inputRuntimeModuleName},
            {moduleName: adminConsoleModuleName},
            {moduleName: terminalConsoleModuleName},
            {moduleName: masterDataWorkbenchModuleName},
        ],
        actorDefinitions: createCateringShellActorDefinitions(),
        preSetup: cateringShellPreSetup,
        async install(context: RuntimeModuleContextV2) {
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: cateringShellScreenDefinitions,
            }))

            let lastTcpRouteFingerprint = JSON.stringify({
                activationStatus: selectTcpIdentitySnapshot(context.getState()).activationStatus,
                terminalId: selectTcpIdentitySnapshot(context.getState()).terminalId ?? null,
            })

            context.subscribeState(() => {
                const identity = selectTcpIdentitySnapshot(context.getState())
                const nextFingerprint = JSON.stringify({
                    activationStatus: identity.activationStatus,
                    terminalId: identity.terminalId ?? null,
                })
                if (nextFingerprint === lastTcpRouteFingerprint) {
                    return
                }
                lastTcpRouteFingerprint = nextFingerprint
                void replaceCateringShellRootScreen(context, {
                    activated: identity.activationStatus === 'ACTIVATED',
                    terminalId: identity.terminalId,
                    source: `${moduleName}.tcpStateSync`,
                })
            })

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
