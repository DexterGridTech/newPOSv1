import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const cateringProductMasterDataCommandDefinitions = {
    cateringProductMasterDataChanged: defineModuleCommand<{
        topic: string
        itemKeys: string[]
        changedAt: number
    }>('master-data-changed', {
        allowNoActor: true,
    }),
    resetCateringProductMasterData: defineModuleCommand<Record<string, never>>('reset-master-data'),
    rebuildCateringProductMasterDataFromTdp: defineModuleCommand<Record<string, never>>('rebuild-master-data-from-tdp'),
} as const
