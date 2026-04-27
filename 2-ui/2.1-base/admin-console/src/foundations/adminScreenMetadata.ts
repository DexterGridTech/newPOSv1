import {adminConsoleTabs} from './adminTabs'
import type {AdminConsoleTab} from '../types'

export const adminConsoleScreenContainers = {
    tabContent: 'ui.base.admin-console.tab-content.container',
} as const

export interface AdminConsoleTabScreenProps {
    tab: AdminConsoleTab
}

const adminConsoleTabKeys = new Set<AdminConsoleTab>(
    adminConsoleTabs.map(tab => tab.key),
)

export const isAdminConsoleTab = (value: unknown): value is AdminConsoleTab =>
    typeof value === 'string' && adminConsoleTabKeys.has(value as AdminConsoleTab)

export const getAdminConsoleTabScreenPartKey = (tab: AdminConsoleTab) =>
    `ui.base.admin-console.tab.${tab}`

