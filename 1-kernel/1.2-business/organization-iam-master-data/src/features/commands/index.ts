import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const organizationIamMasterDataCommandDefinitions = {
    organizationIamMasterDataChanged: defineModuleCommand<{
        topic: string
        itemKeys: string[]
        changedAt: number
    }>('master-data-changed', {
        allowNoActor: true,
    }),
    resetOrganizationIamMasterData: defineModuleCommand<Record<string, never>>('reset-master-data'),
    rebuildOrganizationIamMasterDataFromTdp: defineModuleCommand<Record<string, never>>('rebuild-master-data-from-tdp'),
} as const

export const organizationIamMasterDataCommandNames = {
    organizationIamMasterDataChanged: organizationIamMasterDataCommandDefinitions.organizationIamMasterDataChanged.commandName,
    resetOrganizationIamMasterData: organizationIamMasterDataCommandDefinitions.resetOrganizationIamMasterData.commandName,
    rebuildOrganizationIamMasterDataFromTdp: organizationIamMasterDataCommandDefinitions.rebuildOrganizationIamMasterDataFromTdp.commandName,
} as const
