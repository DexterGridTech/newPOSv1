import React from 'react'
import {
    defineUiScreenPart,
} from '@next/ui-base-runtime-react'
import {adminConsoleTabs} from './adminTabs'
import {
    adminConsoleScreenContainers,
    getAdminConsoleTabScreenPartKey,
    isAdminConsoleTab,
    type AdminConsoleTabScreenProps,
} from './adminScreenMetadata'
import {getAdminConsoleSectionRegistry} from '../supports/adminSectionRegistry'
import {useAdminPanelContext} from '../contexts'
import type {AdminConsoleTab} from '../types'

const AdminConsoleTabScreen: React.FC<AdminConsoleTabScreenProps> = ({
    tab,
}) => {
    const context = useAdminPanelContext()
    const section = getAdminConsoleSectionRegistry().list()
        .find(candidate => candidate.tab === tab)

    return (
        <>
            {section?.render(context) ?? null}
        </>
    )
}

const toAdminConsoleTabScreenPart = (tab: AdminConsoleTab, index: number) => defineUiScreenPart<AdminConsoleTabScreenProps>({
    partKey: getAdminConsoleTabScreenPartKey(tab),
    rendererKey: getAdminConsoleTabScreenPartKey(tab),
    name: `adminConsoleTab${tab}`,
    title: adminConsoleTabs.find(candidate => candidate.key === tab)?.title ?? tab,
    description: adminConsoleTabs.find(candidate => candidate.key === tab)?.hint ?? tab,
    containerKey: adminConsoleScreenContainers.tabContent,
    indexInContainer: index,
    screenModes: ['DESKTOP', 'MOBILE'],
    workspaces: ['main', 'branch'],
    instanceModes: ['MASTER', 'SLAVE', 'STANDALONE'],
    component: AdminConsoleTabScreen,
})

export const adminConsoleTabScreenParts = Object.fromEntries(
    adminConsoleTabs.map((tab, index) => [tab.key, toAdminConsoleTabScreenPart(tab.key, index)]),
) as Record<AdminConsoleTab, ReturnType<typeof toAdminConsoleTabScreenPart>>

export const adminConsoleScreenParts = {
    ...adminConsoleTabScreenParts,
} as const

export const adminConsoleScreenDefinitions = Object.values(adminConsoleScreenParts)
    .map(part => part.definition)

export const getAdminConsoleTabScreenPart = (tab: AdminConsoleTab) =>
    adminConsoleTabScreenParts[tab]

export const getAdminConsoleTabFromScreenPartKey = (
    partKey: string | undefined,
): AdminConsoleTab | undefined =>
    adminConsoleTabs.find(tab => getAdminConsoleTabScreenPartKey(tab.key) === partKey)?.key

export {
    adminConsoleScreenContainers,
    isAdminConsoleTab,
}
