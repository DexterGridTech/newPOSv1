import React, {createContext, useContext} from 'react'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'

const UiRuntimeContext = createContext<KernelRuntimeV2 | null>(null)

export interface UiRuntimeProviderProps {
    runtime: KernelRuntimeV2
    children: React.ReactNode
}

export const UiRuntimeProvider: React.FC<UiRuntimeProviderProps> = ({
    runtime,
    children,
}) => (
    <UiRuntimeContext.Provider value={runtime}>
        {children}
    </UiRuntimeContext.Provider>
)

export const useUiRuntime = (): KernelRuntimeV2 => {
    const runtime = useContext(UiRuntimeContext)
    if (!runtime) {
        throw new Error('[ui-base-runtime-react] useUiRuntime must be used within UiRuntimeProvider')
    }
    return runtime
}
