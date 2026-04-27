import React, {createContext, useContext} from 'react'
import type {EnhancedStore} from '@reduxjs/toolkit'
import type {KernelRuntimeV2} from '@next/kernel-base-runtime-shell-v2'
import type {AdminHostTools} from '../types'

export interface AdminPanelContextValue {
    runtime: KernelRuntimeV2
    store: EnhancedStore
    closePanel: () => void
    hostTools: Readonly<AdminHostTools>
}

const AdminPanelContext = createContext<AdminPanelContextValue | null>(null)

export const AdminPanelProvider: React.FC<AdminPanelContextValue & {
    children: React.ReactNode
}> = ({
    children,
    ...value
}) => (
    <AdminPanelContext.Provider value={value}>
        {children}
    </AdminPanelContext.Provider>
)

export const useAdminPanelContext = (): AdminPanelContextValue => {
    const value = useContext(AdminPanelContext)
    if (!value) {
        throw new Error('[ui-base-admin-console] useAdminPanelContext must be used within AdminPanelProvider')
    }
    return value
}
