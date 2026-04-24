import {
    createModuleActorFactory,
    createCommand,
    onCommand,
    runtimeShellV2CommandDefinitions,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {organizationIamMasterDataCommandDefinitions} from '@next/kernel-business-organization-iam-master-data'
import {cateringProductMasterDataCommandDefinitions} from '@next/kernel-business-catering-product-master-data'
import {cateringStoreOperatingMasterDataCommandDefinitions} from '@next/kernel-business-catering-store-operating-master-data'
import {selectTcpIsActivated, selectTcpTerminalId} from '@next/kernel-base-tcp-control-runtime-v2'
import {replaceCateringShellRootScreen} from '../../supports/rootScreenRouter'
import {moduleName} from '../../moduleName'

const defineActor = createModuleActorFactory(moduleName)

export const createCateringShellRuntimeInitializeActorDefinition = (): ActorDefinition =>
    defineActor('CateringShellRuntimeInitializeActor', [
        onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
            const state = context.getState()
            const activated = selectTcpIsActivated(state)
            if (!activated) {
                await context.dispatchCommand(createCommand(
                    organizationIamMasterDataCommandDefinitions.resetOrganizationIamMasterData,
                    {},
                ))
                await context.dispatchCommand(createCommand(
                    cateringProductMasterDataCommandDefinitions.resetCateringProductMasterData,
                    {},
                ))
                await context.dispatchCommand(createCommand(
                    cateringStoreOperatingMasterDataCommandDefinitions.resetCateringStoreOperatingMasterData,
                    {},
                ))
            }
            await replaceCateringShellRootScreen(context, {
                activated,
                terminalId: selectTcpTerminalId(state) ?? undefined,
                source: `${moduleName}.initialize`,
            })
            return {
                displayIndex: context.displayContext.displayIndex ?? 0,
                activated,
            }
        }),
    ])
