import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Text, View} from 'react-native'
import {useSelector} from 'react-redux'
import {
    selectRuntimeShellV2ParameterCatalog,
    type KernelRuntimeV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    uiRuntimeV2ParameterDefinitions,
} from '@next/kernel-base-ui-runtime-v2'
import type {RootState} from '@next/kernel-base-state-runtime'
import {EmptyScreen} from './EmptyScreen'
import {LoadingScreen} from './LoadingScreen'
import type {RuntimeReactAutomationBridge, UiRuntimeVariable} from '../../types'
import {useChildScreenPartResolution} from '../../hooks'
import {
    UiRuntimeProvider,
    createUiRuntimeScreenActivityController,
    createUiRuntimeScreenReadyController,
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationAction,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '../../contexts'
import type {ResolvedUiScreenPart} from '../../types'

export interface ScreenContainerProps {
    containerPart: string | UiRuntimeVariable
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
    automationTarget?: 'primary' | 'secondary'
    cacheSize?: number
}

const MissingRendererScreen: React.FC<{
    containerKey: string
    partKey: string
    id?: string | null
    rendererKey: string
}> = ({containerKey, partKey, id, rendererKey}) => (
    <View
        testID="ui-base-runtime-react:missing-renderer"
        style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#fff7ed',
        }}
    >
        <View
            style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#fed7aa',
                backgroundColor: '#ffffff',
                padding: 18,
                gap: 8,
            }}
        >
            <Text style={{fontSize: 18, fontWeight: '800', color: '#9a3412'}}>
                UI 渲染器未注册
            </Text>
            <Text style={{fontSize: 13, lineHeight: 20, color: '#7c2d12'}}>
                当前 screen 已进入容器，但 runtime-react 找不到对应 renderer。请检查对应 UI 包是否在 preSetup 中注册了 screen part。
            </Text>
            <Text selectable style={{fontSize: 12, color: '#475569'}}>
                containerKey: {containerKey}
            </Text>
            <Text selectable style={{fontSize: 12, color: '#475569'}}>
                partKey: {partKey}
            </Text>
            {id ? (
                <Text selectable style={{fontSize: 12, color: '#475569'}}>
                    id: {id}
                </Text>
            ) : null}
            <Text selectable style={{fontSize: 12, color: '#475569'}}>
                rendererKey: {rendererKey}
            </Text>
        </View>
    </View>
)

type ScreenCacheItem = {
    key: string
    screenKey: string
    source?: string
    child: ResolvedUiScreenPart
    controllers: ScreenRuntimeControllers
}

type PendingScreen = ScreenCacheItem & {
    token: number
}

type ScreenRuntimeControllers = {
    screenActivityController: ReturnType<typeof createUiRuntimeScreenActivityController>
    screenReadyController: ReturnType<typeof createUiRuntimeScreenReadyController>
}

type ScreenTransition = {
    key: string
    phase: 'loading' | 'content'
}

const createScreenCacheKey = (
    containerKey: string,
    child: Pick<ResolvedUiScreenPart, 'partKey' | 'id'>,
) => `${containerKey}:${child.partKey}:${child.id ?? 'default'}`

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)

const areScreenPropsEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) {
        return true
    }
    if (!isPlainRecord(left) || !isPlainRecord(right)) {
        return false
    }
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
        return false
    }
    return leftKeys.every(key =>
        Object.prototype.hasOwnProperty.call(right, key)
        && Object.is(left[key], right[key]),
    )
}

const canReuseScreenCacheItem = (
    cached: ScreenCacheItem,
    nextItem: ScreenCacheItem,
) => cached.child.Component === nextItem.child.Component
    && cached.child.partKey === nextItem.child.partKey
    && cached.child.rendererKey === nextItem.child.rendererKey
    && cached.child.id === nextItem.child.id
    && areScreenPropsEqual(cached.child.props, nextItem.child.props)

const createScreenRuntimeControllers = (): ScreenRuntimeControllers => ({
    screenActivityController: createUiRuntimeScreenActivityController(false),
    screenReadyController: createUiRuntimeScreenReadyController(false),
})

const createScreenCacheItem = (
    key: string,
    child: ResolvedUiScreenPart,
    previous?: ScreenCacheItem,
): ScreenCacheItem => ({
    key,
    screenKey: child.partKey,
    source: child.source,
    child,
    controllers: previous?.controllers ?? createScreenRuntimeControllers(),
})

const activateScreenCacheItem = (item: ScreenCacheItem) => {
    item.controllers.screenReadyController.reset()
}

const trimScreenCache = (
    items: readonly ScreenCacheItem[],
    maxSize: number,
    recency: Map<string, number>,
): ScreenCacheItem[] => {
    if (items.length <= maxSize) {
        return items as ScreenCacheItem[]
    }
    const keepKeys = new Set(
        [...items]
            .sort((left, right) => (recency.get(right.key) ?? 0) - (recency.get(left.key) ?? 0))
            .slice(0, maxSize)
            .map(item => item.key),
    )
    for (const key of [...recency.keys()]) {
        if (!keepKeys.has(key)) {
            recency.delete(key)
        }
    }
    return items.filter(item => keepKeys.has(item.key))
}

const upsertScreenCacheItem = (
    items: readonly ScreenCacheItem[],
    nextItem: ScreenCacheItem,
    maxSize: number,
    recency: Map<string, number>,
): ScreenCacheItem[] => {
    const existingIndex = items.findIndex(item => item.key === nextItem.key)
    if (existingIndex >= 0 && items[existingIndex] === nextItem && items.length <= maxSize) {
        return items as ScreenCacheItem[]
    }
    const next = existingIndex >= 0
        ? items.map(item => item.key === nextItem.key ? nextItem : item)
        : [...items, nextItem]
    return trimScreenCache(next, maxSize, recency)
}

const scheduleAfterPaint = (callback: () => void): (() => void) => {
    let completed = false
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    const run = () => {
        if (completed) {
            return
        }
        completed = true
        if (fallbackTimer) {
            clearTimeout(fallbackTimer)
            fallbackTimer = null
        }
        callback()
    }
    if (typeof requestAnimationFrame === 'function') {
        let innerFrame: number | null = null
        const outerFrame = requestAnimationFrame(() => {
            innerFrame = requestAnimationFrame(run)
        })
        fallbackTimer = setTimeout(run, 48)
        return () => {
            completed = true
            cancelAnimationFrame(outerFrame)
            if (innerFrame !== null) {
                cancelAnimationFrame(innerFrame)
            }
            if (fallbackTimer) {
                clearTimeout(fallbackTimer)
            }
        }
    }
    let innerTimer: ReturnType<typeof setTimeout> | null = null
    const outerTimer = setTimeout(() => {
        innerTimer = setTimeout(run, 0)
    }, 0)
    return () => {
        completed = true
        clearTimeout(outerTimer)
        if (innerTimer) {
            clearTimeout(innerTimer)
        }
    }
}

const hiddenScreenStyle = {
    display: 'none',
} as const

const visibleScreenStyle = {
    flex: 1,
    minHeight: 0,
} as const

const screenContainerStyle = {
    flex: 1,
    minHeight: 180,
    position: 'relative',
} as const

const loadingOverlayStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
} as const

const LoadingOverlay: React.FC<{
    testID: string
    transitionKey: string
    onCommitted: () => void
}> = ({testID, transitionKey, onCommitted}) => {
    useEffect(() => scheduleAfterPaint(onCommitted), [onCommitted, transitionKey])

    return (
        <View
            testID={`${testID}-overlay`}
            style={loadingOverlayStyle}
        >
            <LoadingScreen testID={`${testID}:surface`} />
        </View>
    )
}

type SlotAutomationBridge = RuntimeReactAutomationBridge & {
    setActive(active: boolean): void
    dispose(): void
}

type SlotAutomationNodeRecord = {
    node: Parameters<RuntimeReactAutomationBridge['registerNode']>[0]
    unregister?: () => void
}

const normalizeSlotAutomationNode = (
    node: Parameters<RuntimeReactAutomationBridge['registerNode']>[0],
    screenKey: string,
): Parameters<RuntimeReactAutomationBridge['registerNode']>[0] => ({
    ...node,
    screenKey,
})

const createSlotAutomationBridge = (
    parentBridge: RuntimeReactAutomationBridge | undefined,
    initiallyActive: boolean,
    screenKey: string,
): SlotAutomationBridge | undefined => {
    if (!parentBridge) {
        return undefined
    }

    let active = initiallyActive
    const records = new Map<string, SlotAutomationNodeRecord>()
    const keyOf = (
        target: Parameters<RuntimeReactAutomationBridge['updateNode']>[0],
        nodeId: string,
    ) => `${target}:${nodeId}`

    const unregisterRecord = (record: SlotAutomationNodeRecord) => {
        record.unregister?.()
        record.unregister = undefined
    }

    const registerRecord = (record: SlotAutomationNodeRecord) => {
        unregisterRecord(record)
        record.unregister = parentBridge.registerNode(record.node)
    }

    return {
        registerNode(node) {
            const key = keyOf(node.target, node.nodeId)
            const record: SlotAutomationNodeRecord = {node: normalizeSlotAutomationNode(node, screenKey)}
            records.get(key)?.unregister?.()
            records.set(key, record)
            if (active) {
                registerRecord(record)
            }
            return () => {
                if (records.get(key) !== record) {
                    return
                }
                unregisterRecord(record)
                records.delete(key)
            }
        },
        updateNode(target, nodeId, patch) {
            const key = keyOf(target, nodeId)
            const record = records.get(key)
            if (!record) {
                if (active) {
                    parentBridge.updateNode(target, nodeId, {
                        ...patch,
                        target,
                        nodeId,
                        screenKey,
                    })
                }
                return
            }
            record.node = {
                ...record.node,
                ...patch,
                target,
                nodeId,
                screenKey,
            }
            if (active) {
                parentBridge.updateNode(target, nodeId, {
                    ...patch,
                    target,
                    nodeId,
                    screenKey,
                })
            }
        },
        clearVisibleContexts(target, visibleContextKeys) {
            if (active) {
                parentBridge.clearVisibleContexts(target, visibleContextKeys)
            }
        },
        clearTarget(target) {
            for (const [key, record] of records.entries()) {
                if (record.node.target !== target) {
                    continue
                }
                unregisterRecord(record)
                records.delete(key)
            }
            if (active) {
                parentBridge.clearTarget(target)
            }
        },
        setActive(nextActive) {
            if (active === nextActive) {
                return
            }
            active = nextActive
            for (const record of records.values()) {
                if (active) {
                    registerRecord(record)
                } else {
                    unregisterRecord(record)
                }
            }
        },
        dispose() {
            for (const record of records.values()) {
                unregisterRecord(record)
            }
            records.clear()
        },
    }
}

const ScreenLifecycleContent: React.FC<{
    item: ScreenCacheItem
    runtime: KernelRuntimeV2
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId: string
    performAutomationAction?: (input: {
        nodeId: string
        action: string
        value?: unknown
    }) => Promise<unknown> | unknown
}> = React.memo(({
    item,
    runtime,
    automationBridge,
    automationRuntimeId,
    performAutomationAction,
}) => {
    const Component = item.child.Component
    const {screenActivityController, screenReadyController} = item.controllers

    return (
        <UiRuntimeProvider
            runtime={runtime}
            automationBridge={automationBridge}
            automationRuntimeId={automationRuntimeId}
            screenActivityController={screenActivityController}
            screenReadyController={screenReadyController}
            performAutomationAction={performAutomationAction}
        >
            <Component {...(item.child.props as object)} />
        </UiRuntimeProvider>
    )
})

ScreenLifecycleContent.displayName = 'ScreenLifecycleContent'

const ScreenLifecycleSlot: React.FC<{
    item: ScreenCacheItem
    active: boolean
    testID: string
    runtime: KernelRuntimeV2
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId: string
    performAutomationAction?: (input: {
        nodeId: string
        action: string
        value?: unknown
    }) => Promise<unknown> | unknown
    onCommitted?: (key: string) => void
    onReady?: (key: string) => void
}> = ({
    item,
    active,
    testID,
    runtime,
    automationBridge,
    automationRuntimeId,
    performAutomationAction,
    onCommitted,
    onReady,
}) => {
    const {screenActivityController, screenReadyController} = item.controllers
    const slotAutomationBridge = useMemo(
        () => createSlotAutomationBridge(automationBridge, active, item.screenKey),
        [automationBridge, item.screenKey],
    )

    useLayoutEffect(() => {
        screenActivityController.setActive(active)
        slotAutomationBridge?.setActive(active)
    }, [active, screenActivityController, slotAutomationBridge])

    useEffect(() => {
        screenActivityController.setActive(active)
        slotAutomationBridge?.setActive(active)
    }, [active, screenActivityController, slotAutomationBridge])

    useLayoutEffect(() => () => {
        slotAutomationBridge?.dispose()
    }, [slotAutomationBridge])

    useEffect(() => {
        onCommitted?.(item.key)
    }, [item.key, onCommitted])

    useEffect(() => {
        if (active) {
            screenReadyController.markReadyIfNoGate()
        }
    }, [active, screenReadyController])

    useEffect(() => {
        if (!active) {
            return undefined
        }
        const notifyReady = () => {
            if (screenReadyController.getSnapshot()) {
                onReady?.(item.key)
            }
        }
        notifyReady()
        return screenReadyController.subscribe(notifyReady)
    }, [active, item.key, onReady, screenReadyController])

    return (
        <View
            testID={testID}
            style={active ? visibleScreenStyle : hiddenScreenStyle}
        >
            <ScreenLifecycleContent
                item={item}
                runtime={runtime}
                automationBridge={slotAutomationBridge}
                automationRuntimeId={automationRuntimeId}
                performAutomationAction={performAutomationAction}
            />
        </View>
    )
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
    containerPart,
    automationBridge: automationBridgeProp,
    automationRuntimeId: automationRuntimeIdProp,
    automationTarget: automationTargetProp,
    cacheSize,
}) => {
    const runtime = useUiRuntime()
    const automationBridge = automationBridgeProp ?? useOptionalUiAutomationBridge() ?? undefined
    const automationRuntimeId = automationRuntimeIdProp
        ?? useOptionalUiAutomationRuntimeId()
        ?? runtime.runtimeId
    const performAutomationAction = useOptionalUiAutomationAction() ?? undefined
    const automationTarget = automationTargetProp
        ?? useOptionalUiAutomationTarget()
        ?? 'primary'
    const resolution = useChildScreenPartResolution(containerPart)
    const cacheSizeCatalogRawValue = useSelector<RootState, unknown>(state =>
        selectRuntimeShellV2ParameterCatalog(state)[
            uiRuntimeV2ParameterDefinitions.screenContainerCacheSize.key
        ]?.rawValue,
    )
    const maxCacheSize = useMemo(() => {
        if (typeof cacheSize === 'number' && Number.isFinite(cacheSize)) {
            return Math.max(1, Math.floor(cacheSize))
        }
        const resolved = runtime.resolveParameter({
            key: uiRuntimeV2ParameterDefinitions.screenContainerCacheSize.key,
            definition: uiRuntimeV2ParameterDefinitions.screenContainerCacheSize,
        })
        return Math.max(1, Math.floor(resolved.value))
    }, [runtime, cacheSize, cacheSizeCatalogRawValue])
    const [cachedScreens, setCachedScreens] = useState<ScreenCacheItem[]>([])
    const cachedScreensRef = useRef<ScreenCacheItem[]>([])
    const [activeKey, setActiveKey] = useState<string | null>(null)
    const [pendingScreen, setPendingScreen] = useState<PendingScreen | null>(null)
    const pendingScreenRef = useRef<PendingScreen | null>(null)
    const [shouldMountPendingScreen, setShouldMountPendingScreen] = useState(false)
    const [transition, setTransition] = useState<ScreenTransition | null>(null)
    const transitionRef = useRef<ScreenTransition | null>(null)
    const requestedKeyRef = useRef<string | null>(null)
    const cacheRecencyRef = useRef(new Map<string, number>())
    const tokenRef = useRef(0)

    const updateCachedScreens = useCallback((
        updater: (items: readonly ScreenCacheItem[]) => ScreenCacheItem[],
    ) => {
        setCachedScreens(previous => {
            const next = updater(previous)
            if (next === previous) {
                return previous
            }
            cachedScreensRef.current = next
            return next
        })
    }, [])

    const syncTransition = useCallback((nextTransition: ScreenTransition | null) => {
        transitionRef.current = nextTransition
        setTransition(nextTransition)
    }, [])

    const startTransitionForKey = useCallback((key: string): ScreenTransition => {
        const current = transitionRef.current
        if (current?.key === key) {
            return current
        }
        const nextTransition: ScreenTransition = {
            key,
            phase: 'loading',
        }
        syncTransition(nextTransition)
        return nextTransition
    }, [syncTransition])

    const clearTransitionForKey = useCallback((key: string) => {
        if (transitionRef.current?.key === key) {
            syncTransition(null)
        }
    }, [syncTransition])

    const clearTransition = useCallback(() => {
        const current = transitionRef.current
        if (current) {
            syncTransition(null)
        }
    }, [syncTransition])

    const releaseTransitionContent = useCallback((key: string) => {
        const current = transitionRef.current
        if (!current || current.key !== key || current.phase === 'content') {
            return
        }
        syncTransition({
            ...current,
            phase: 'content',
        })
    }, [syncTransition])

    const resetContainerRuntimeState = useCallback(() => {
        requestedKeyRef.current = null
        pendingScreenRef.current = null
        cacheRecencyRef.current.clear()
        clearTransition()
        cachedScreensRef.current = []
        setCachedScreens([])
        setPendingScreen(null)
        setShouldMountPendingScreen(false)
        setActiveKey(null)
    }, [clearTransition])

    const activateSameScreenPart = useCallback((
        key: string,
        child: ResolvedUiScreenPart,
    ) => {
        requestedKeyRef.current = key
        pendingScreenRef.current = null
        setPendingScreen(null)
        setShouldMountPendingScreen(false)
        if (transitionRef.current && transitionRef.current.key !== key) {
            clearTransition()
        }
        const cached = cachedScreensRef.current.find(item => item.key === key)
        const nextItem = createScreenCacheItem(key, child, cached)
        const cacheItem = cached && canReuseScreenCacheItem(cached, nextItem)
            ? cached
            : nextItem
        if (!cached || cacheItem !== cached) {
            cacheRecencyRef.current.set(key, Date.now())
            updateCachedScreens(items => upsertScreenCacheItem(
                items,
                cacheItem,
                maxCacheSize,
                cacheRecencyRef.current,
            ))
        }
        setActiveKey(currentActiveKey => {
            if (currentActiveKey !== key) {
                activateScreenCacheItem(cacheItem)
            }
            return key
        })
    }, [clearTransition, maxCacheSize, updateCachedScreens])

    const prepareTargetTransition = useCallback((key: string): ScreenTransition => {
        requestedKeyRef.current = key
        if (pendingScreenRef.current && pendingScreenRef.current.key !== key) {
            pendingScreenRef.current = null
            setPendingScreen(null)
            setShouldMountPendingScreen(false)
        }
        const currentTransition = startTransitionForKey(key)
        return transitionRef.current?.key === key
            ? transitionRef.current
            : currentTransition
    }, [startTransitionForKey])

    const activateCachedScreen = useCallback((
        key: string,
        child: ResolvedUiScreenPart,
    ): boolean => {
        const cached = cachedScreensRef.current.find(item => item.key === key)
        if (!cached) {
            return false
        }
        const nextItem = createScreenCacheItem(key, child, cached)
        const cacheItem = canReuseScreenCacheItem(cached, nextItem)
            ? cached
            : nextItem
        cacheRecencyRef.current.set(key, Date.now())
        pendingScreenRef.current = null
        setPendingScreen(null)
        setShouldMountPendingScreen(false)
        updateCachedScreens(items => upsertScreenCacheItem(
            items,
            cacheItem,
            maxCacheSize,
            cacheRecencyRef.current,
        ))
        activateScreenCacheItem(cacheItem)
        setActiveKey(key)
        return true
    }, [maxCacheSize, updateCachedScreens])

    const mountPendingScreenAfterLoading = useCallback((
        key: string,
        child: ResolvedUiScreenPart,
    ) => {
        if (pendingScreenRef.current?.key === key) {
            if (!shouldMountPendingScreen) {
                setShouldMountPendingScreen(true)
            }
            return
        }

        tokenRef.current += 1
        const nextPendingScreen: PendingScreen = {
            ...createScreenCacheItem(key, child),
            token: tokenRef.current,
        }
        pendingScreenRef.current = nextPendingScreen
        setPendingScreen(nextPendingScreen)
        setShouldMountPendingScreen(true)
    }, [shouldMountPendingScreen])

    const requestedCacheKey = resolution.status === 'ready'
        ? createScreenCacheKey(resolution.containerKey, resolution.child)
        : null
    const effectivePendingScreen = pendingScreen && pendingScreen.key === requestedCacheKey
        ? pendingScreen
        : null
    const activeCachedScreen = activeKey
        ? cachedScreens.find(item => item.key === activeKey)
        : undefined
    const activeScreenPartKey = activeCachedScreen?.child.partKey
    const requestedScreenKey = resolution.status === 'ready'
        ? resolution.child.partKey
        : resolution.status === 'missing-renderer'
            ? resolution.missing.partKey
            : 'empty'
    const requestedLoadingKey = resolution.status === 'ready'
        && activeScreenPartKey !== resolution.child.partKey
        ? requestedCacheKey
        : null
    const visibleLoadingKey = transition?.key ?? requestedLoadingKey
    const shouldShowLoadingOverlay = Boolean(visibleLoadingKey)
    const baseVisibleScreenKey = activeCachedScreen?.screenKey ?? requestedScreenKey
    const visibleScreenKey = shouldShowLoadingOverlay
        ? 'loading'
        : baseVisibleScreenKey
    const renderedScreens = useMemo(() => {
        if (!effectivePendingScreen || !shouldMountPendingScreen) {
            return cachedScreens
        }
        if (cachedScreens.some(item => item.key === effectivePendingScreen.key)) {
            return cachedScreens
        }
        return [effectivePendingScreen, ...cachedScreens]
    }, [cachedScreens, effectivePendingScreen, shouldMountPendingScreen])
    const visibleContextKeys = useMemo(() => {
        const keys = new Set(['runtime-root', 'overlay', 'alert', visibleScreenKey])
        if (shouldShowLoadingOverlay) {
            keys.add(baseVisibleScreenKey)
        }
        return [...keys]
    }, [baseVisibleScreenKey, shouldShowLoadingOverlay, visibleScreenKey])

    useEffect(() => {
        updateCachedScreens(items => {
            const next = trimScreenCache(items, maxCacheSize, cacheRecencyRef.current)
            if (activeKey && !next.some(item => item.key === activeKey)) {
                cacheRecencyRef.current.delete(activeKey)
                setActiveKey(null)
            }
            cachedScreensRef.current = next
            return next
        })
    }, [activeKey, maxCacheSize, updateCachedScreens])

    useLayoutEffect(() => {
        if (resolution.status !== 'ready') {
            resetContainerRuntimeState()
            return
        }

        const key = createScreenCacheKey(resolution.containerKey, resolution.child)
        const activeScreenPartKey = activeKey
            ? cachedScreensRef.current.find(item => item.key === activeKey)?.child.partKey
            : undefined
        const sameScreenAlreadyActive = activeScreenPartKey === resolution.child.partKey
        if (sameScreenAlreadyActive) {
            activateSameScreenPart(key, resolution.child)
            return
        }

        const transitionForKey = prepareTargetTransition(key)
        if (transitionForKey.phase !== 'content') {
            return
        }

        if (activateCachedScreen(key, resolution.child)) {
            return
        }

        mountPendingScreenAfterLoading(key, resolution.child)
    }, [
        activeKey,
        activateCachedScreen,
        activateSameScreenPart,
        mountPendingScreenAfterLoading,
        prepareTargetTransition,
        resetContainerRuntimeState,
        resolution,
        transition?.phase,
        transition?.key,
    ])

    const completePendingScreen = useCallback((key: string) => {
        const current = pendingScreenRef.current
        if (
            !current
            || current.key !== key
            || requestedKeyRef.current !== key
            || transitionRef.current?.key !== key
            || transitionRef.current.phase !== 'content'
        ) {
            return
        }
        cacheRecencyRef.current.set(key, Date.now())
        updateCachedScreens(items => upsertScreenCacheItem(
            items,
            current,
            maxCacheSize,
            cacheRecencyRef.current,
        ))
        pendingScreenRef.current = null
        setPendingScreen(null)
        setShouldMountPendingScreen(false)
        activateScreenCacheItem(current)
        setActiveKey(key)
    }, [maxCacheSize, updateCachedScreens])

    const completeActiveScreenReady = useCallback((key: string) => {
        if (transitionRef.current?.key !== key || transitionRef.current.phase !== 'content') {
            return
        }
        cacheRecencyRef.current.set(key, Date.now())
        clearTransitionForKey(key)
    }, [clearTransitionForKey])

    const handleLoadingCommitted = useCallback(() => {
        const currentTransition = transitionRef.current
        if (!currentTransition) {
            return
        }
        releaseTransitionContent(currentTransition.key)
    }, [releaseTransitionContent])

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        automationBridge.clearVisibleContexts(automationTarget, visibleContextKeys)
        const unregisters: Array<() => void> = [
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey: visibleScreenKey,
                mountId: `screen:${automationTarget}:${visibleScreenKey}`,
                nodeId: `screen:${automationTarget}:${visibleScreenKey}`,
                testID: `ui-base-screen-container:${automationTarget}`,
                semanticId: visibleScreenKey,
                role: 'screen',
                text: visibleScreenKey,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
        ]
        if (shouldShowLoadingOverlay) {
            unregisters.push(automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey: 'loading',
                mountId: `screen:${automationTarget}:loading`,
                nodeId: `screen:${automationTarget}:loading`,
                testID: `ui-base-screen-container:${automationTarget}:loading`,
                semanticId: 'loading',
                role: 'progressbar',
                text: '正在加载',
                visible: true,
                enabled: true,
                availableActions: [],
            }))
        }
        return () => {
            unregisters.forEach(unregister => unregister())
        }
    }, [
        automationBridge,
        automationRuntimeId,
        automationTarget,
        shouldShowLoadingOverlay,
        visibleContextKeys,
        visibleScreenKey,
    ])

    const renderLoadingOverlay = () => {
        if (!visibleLoadingKey) {
            return null
        }
        return (
            <LoadingOverlay
                testID={`ui-base-screen-container:${automationTarget}:loading`}
                transitionKey={visibleLoadingKey}
                onCommitted={handleLoadingCommitted}
            />
        )
    }

    if (resolution.status === 'empty') {
        return (
            <View testID={`ui-base-screen-container:${automationTarget}`} style={screenContainerStyle}>
                <EmptyScreen />
                {renderLoadingOverlay()}
            </View>
        )
    }
    if (resolution.status === 'missing-renderer') {
        return (
            <View testID={`ui-base-screen-container:${automationTarget}`} style={screenContainerStyle}>
                <MissingRendererScreen
                    containerKey={resolution.containerKey}
                    partKey={resolution.missing.partKey}
                    id={resolution.missing.id}
                    rendererKey={resolution.missing.rendererKey}
                />
                {renderLoadingOverlay()}
            </View>
        )
    }

    return (
        <View testID={`ui-base-screen-container:${automationTarget}`} style={screenContainerStyle}>
            {renderedScreens.map(item => (
                <ScreenLifecycleSlot
                    key={item.key}
                    item={item}
                    active={item.key === activeKey}
                    testID={`ui-base-screen-container:${automationTarget}:slot:${item.key}`}
                    runtime={runtime}
                    automationBridge={automationBridge}
                    automationRuntimeId={automationRuntimeId}
                    performAutomationAction={performAutomationAction}
                    onCommitted={pendingScreen?.key === item.key ? completePendingScreen : undefined}
                    onReady={completeActiveScreenReady}
                />
            ))}
            {renderLoadingOverlay()}
        </View>
    )
}
