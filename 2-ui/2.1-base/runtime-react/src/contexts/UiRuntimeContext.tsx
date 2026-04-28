import React, {createContext, useContext, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react'
import type {KernelRuntimeV2} from '@next/kernel-base-runtime-shell-v2'
import type {RuntimeReactAutomationBridge} from '../types'

const UiRuntimeContext = createContext<KernelRuntimeV2 | null>(null)
const UiRuntimeAutomationContext = createContext<RuntimeReactAutomationBridge | null>(null)
const UiRuntimeAutomationRuntimeIdContext = createContext<string | undefined>(undefined)
export interface UiRuntimeScreenActivityController {
    getSnapshot(): boolean
    setActive(active: boolean): void
    getVersion(): number
    subscribe(listener: () => void): () => void
}

export interface UiRuntimeScreenReadyController {
    getSnapshot(): boolean
    getGeneration(): number
    reset(): number
    registerReadyGate(generation?: number): () => void
    markReady(generation?: number): boolean
    markReadyIfNoGate(generation?: number): boolean
    subscribe(listener: () => void): () => void
}

const defaultScreenActivityController: UiRuntimeScreenActivityController = {
    getSnapshot: () => true,
    setActive: () => {},
    getVersion: () => 0,
    subscribe: () => () => {},
}

const UiRuntimeScreenActivityContext = createContext<UiRuntimeScreenActivityController>(defaultScreenActivityController)
const defaultScreenReadyController: UiRuntimeScreenReadyController = {
    getSnapshot: () => true,
    getGeneration: () => 0,
    reset: () => 0,
    registerReadyGate: () => () => {},
    markReady: () => true,
    markReadyIfNoGate: () => true,
    subscribe: () => () => {},
}

const UiRuntimeScreenReadyContext = createContext<UiRuntimeScreenReadyController>(defaultScreenReadyController)
const UiRuntimeAutomationActionContext = createContext<((input: {
    nodeId: string
    action: string
    value?: unknown
}) => Promise<unknown> | unknown) | null>(null)

export const createUiRuntimeScreenActivityController = (
    initiallyActive = true,
): UiRuntimeScreenActivityController => {
    let active = Boolean(initiallyActive)
    let version = 0
    const listeners = new Set<() => void>()

    return {
        getSnapshot: () => active,
        getVersion: () => version,
        setActive(nextActive) {
            const normalizedActive = Boolean(nextActive)
            if (active === normalizedActive) {
                return
            }
            active = normalizedActive
            version += 1
            for (const listener of [...listeners]) {
                if (listeners.has(listener)) {
                    listener()
                }
            }
        },
        subscribe(listener) {
            listeners.add(listener)
            let disposed = false
            return () => {
                if (disposed) {
                    return
                }
                disposed = true
                listeners.delete(listener)
            }
        },
    }
}

export const createUiRuntimeScreenReadyController = (
    initiallyReady = false,
): UiRuntimeScreenReadyController => {
    let ready = Boolean(initiallyReady)
    let generation = 0
    let readyGateCount = 0
    const listeners = new Set<() => void>()

    const notify = () => {
        for (const listener of [...listeners]) {
            if (listeners.has(listener)) {
                listener()
            }
        }
    }

    const generationMatches = (inputGeneration = generation) => inputGeneration === generation
    const markReady = (inputGeneration = generation) => {
        if (!generationMatches(inputGeneration)) {
            return false
        }
        if (ready) {
            return true
        }
        ready = true
        notify()
        return true
    }

    return {
        getSnapshot: () => ready,
        getGeneration: () => generation,
        reset() {
            generation += 1
            ready = false
            readyGateCount = 0
            notify()
            return generation
        },
        registerReadyGate(inputGeneration = generation) {
            if (!generationMatches(inputGeneration)) {
                return () => {}
            }
            readyGateCount += 1
            notify()
            let disposed = false
            return () => {
                if (disposed) {
                    return
                }
                disposed = true
                if (!generationMatches(inputGeneration)) {
                    return
                }
                readyGateCount = Math.max(0, readyGateCount - 1)
                notify()
            }
        },
        markReady,
        markReadyIfNoGate(inputGeneration = generation) {
            if (!generationMatches(inputGeneration) || readyGateCount > 0) {
                return false
            }
            return markReady(inputGeneration)
        },
        subscribe(listener) {
            listeners.add(listener)
            let disposed = false
            return () => {
                if (disposed) {
                    return
                }
                disposed = true
                listeners.delete(listener)
            }
        },
    }
}

export interface UiRuntimeProviderProps {
    runtime: KernelRuntimeV2
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
    screenActivityController?: UiRuntimeScreenActivityController
    screenReadyController?: UiRuntimeScreenReadyController
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
    screenActivityController,
    screenReadyController,
    performAutomationAction,
    children,
}) => (
    <UiRuntimeContext.Provider value={runtime}>
        <UiRuntimeScreenActivityContext.Provider value={screenActivityController ?? defaultScreenActivityController}>
            <UiRuntimeScreenReadyContext.Provider value={screenReadyController ?? defaultScreenReadyController}>
                <UiRuntimeAutomationContext.Provider value={automationBridge ?? null}>
                    <UiRuntimeAutomationRuntimeIdContext.Provider value={automationRuntimeId}>
                        <UiRuntimeAutomationActionContext.Provider value={performAutomationAction ?? null}>
                            {children}
                        </UiRuntimeAutomationActionContext.Provider>
                    </UiRuntimeAutomationRuntimeIdContext.Provider>
                </UiRuntimeAutomationContext.Provider>
            </UiRuntimeScreenReadyContext.Provider>
        </UiRuntimeScreenActivityContext.Provider>
    </UiRuntimeContext.Provider>
)

export const useUiRuntimeScreenActive = (): boolean => {
    const controller = useContext(UiRuntimeScreenActivityContext)
    return useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
    )
}

export const useUiRuntimeScreenActivityController = (): UiRuntimeScreenActivityController =>
    useContext(UiRuntimeScreenActivityContext)

export const useUiRuntimeScreenReadyController = (): UiRuntimeScreenReadyController =>
    useContext(UiRuntimeScreenReadyContext)

export const useScreenReady = (ready = true): (() => void) => {
    const controller = useUiRuntimeScreenReadyController()
    const generation = useSyncExternalStore(
        controller.subscribe,
        controller.getGeneration,
        controller.getGeneration,
    )
    const markReady = useCallback(() => {
        controller.markReady(generation)
    }, [controller, generation])

    useLayoutEffect(() => controller.registerReadyGate(generation), [controller, generation])

    useEffect(() => {
        if (ready) {
            markReady()
        }
    }, [markReady, ready])

    return markReady
}

export const useOnUiRuntimeScreenActivated = (
    callback: () => void,
): void => {
    const controller = useUiRuntimeScreenActivityController()
    const callbackRef = useRef(callback)
    callbackRef.current = callback

    useEffect(() => controller.subscribe(() => {
        if (controller.getSnapshot()) {
            callbackRef.current()
        }
    }), [controller])
}

export const useUiRuntimeScreenActiveVersion = (): number => {
    const controller = useUiRuntimeScreenActivityController()
    return useSyncExternalStore(
        controller.subscribe,
        controller.getVersion,
        controller.getVersion,
    )
}

export const useUiRuntimeScreenGatedStoreSubscription = <TSnapshot,>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => TSnapshot,
    isEqual: (left: TSnapshot | undefined, right: TSnapshot) => boolean = Object.is,
): TSnapshot => {
    const active = useUiRuntimeScreenActive()
    const snapshotRef = useRef<TSnapshot | undefined>(undefined)
    const [snapshot, setSnapshot] = useState(() => {
        const initialSnapshot = getSnapshot()
        snapshotRef.current = initialSnapshot
        return initialSnapshot
    })

    const refreshSnapshot = useCallback(() => {
        const nextSnapshot = getSnapshot()
        if (isEqual(snapshotRef.current, nextSnapshot)) {
            return
        }
        snapshotRef.current = nextSnapshot
        setSnapshot(nextSnapshot)
    }, [getSnapshot, isEqual])

    useEffect(() => {
        if (!active) {
            return undefined
        }
        refreshSnapshot()
        return subscribe(refreshSnapshot)
    }, [active, refreshSnapshot, subscribe])

    return snapshot
}

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
