import {
    defineUiScreenPart,
    uiRuntimeRootVariables,
} from '@impos2/ui-base-runtime-react'
import {MasterDataWorkbenchScreen} from '../ui/screens'

export const masterDataWorkbenchScreenKeys = {
    primaryWorkbench: 'ui.business.catering-master-data-workbench.primary-workbench',
    secondaryWorkbench: 'ui.business.catering-master-data-workbench.secondary-workbench',
} as const

export const masterDataWorkbenchScreenParts = {
    primaryWorkbench: defineUiScreenPart({
        partKey: masterDataWorkbenchScreenKeys.primaryWorkbench,
        rendererKey: masterDataWorkbenchScreenKeys.primaryWorkbench,
        name: 'cateringMasterDataWorkbenchPrimary',
        title: '餐饮主数据工作台 Primary',
        description: '终端侧主屏餐饮主数据查看工作台',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 20,
        screenModes: ['PRIMARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['STANDALONE', 'MASTER', 'SLAVE'],
        component: MasterDataWorkbenchScreen,
    }),
    secondaryWorkbench: defineUiScreenPart({
        partKey: masterDataWorkbenchScreenKeys.secondaryWorkbench,
        rendererKey: masterDataWorkbenchScreenKeys.secondaryWorkbench,
        name: 'cateringMasterDataWorkbenchSecondary',
        title: '餐饮主数据工作台 Secondary',
        description: '终端侧副屏餐饮主数据查看工作台',
        containerKey: uiRuntimeRootVariables.secondaryRootContainer.key,
        indexInContainer: 20,
        screenModes: ['SECONDARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['STANDALONE', 'MASTER', 'SLAVE'],
        component: MasterDataWorkbenchScreen,
    }),
} as const

export const masterDataWorkbenchScreenDefinitions = Object.values(masterDataWorkbenchScreenParts)
    .map(part => part.definition)
