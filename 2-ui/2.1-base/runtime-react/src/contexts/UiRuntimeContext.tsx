import React, {createContext, useContext} from 'react'
import type {KernelRuntimeV2} from '@next/kernel-base-runtime-shell-v2'
import type {RuntimeReactAutomationBridge} from '../types'

const UiRuntimeContext = createContext<KernelRuntimeV2 | null>(null)
const UiRuntimeAutomationContext = createContext<RuntimeReactAutomationBridge | null>(null)
const UiRuntimeAutomationRuntimeIdContext = createContext<string | undefined>(undefined)
const UiRuntimeAutomationActionContext = createContext<((input: {
    nodeId: string
    action: string
    value?: unknown
}) => Promise<unknown> | unknown) | null>(null)

export interface UiRuntimeProviderProps {
    runtime: KernelRuntimeV2
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
    performAutomationAction?: (input: {
        nodeId: string
        action: string
        value?: unknown
    }) => Promise<unknown> | unknown
    children: React.ReactNode
}

export const UiRuntimeProvider: React.FC<UiRuntimeProviderProps> = ({
    runtime,
    automationBridge,
    automationRuntimeId,
    performAutomationAction,
    children,
}) => (
    <UiRuntimeContext.Provider value={runtime}>
        <UiRuntimeAutomationContext.Provider value={automationBridge ?? null}>
            <UiRuntimeAutomationRuntimeIdContext.Provider value={automationRuntimeId}>
                <UiRuntimeAutomationActionContext.Provider value={performAutomationAction ?? null}>
                    {children}
                </UiRuntimeAutomationActionContext.Provider>
            </UiRuntimeAutomationRuntimeIdContext.Provider>
        </UiRuntimeAutomationContext.Provider>
    </UiRuntimeContext.Provider>
)

export const useUiRuntime = (): KernelRuntimeV2 => {
    const runtime = useContext(UiRuntimeContext)
    if (!runtime) {
        throw new Error('[ui-base-runtime-react] useUiRuntime must be used within UiRuntimeProvider')
    }
    return runtime
}

export const useOptionalUiAutomationBridge = (): RuntimeReactAutomationBridge | null =>
    useContext(UiRuntimeAutomationContext)

export const useOptionalUiAutomationRuntimeId = (): string | undefined =>
    useContext(UiRuntimeAutomationRuntimeIdContext)

export const useOptionalUiAutomationTarget = (): 'primary' | 'secondary' | null => {
    const runtime = useContext(UiRuntimeContext)
    if (!runtime) {
        return null
    }
    return (runtime.displayContext.displayIndex ?? 0) > 0 ? 'secondary' : 'primary'
}

export const useOptionalUiAutomationAction = (): ((input: {
    nodeId: string
    action: string
    value?: unknown
}) => Promise<unknown> | unknown) | null =>
    useContext(UiRuntimeAutomationActionContext)
