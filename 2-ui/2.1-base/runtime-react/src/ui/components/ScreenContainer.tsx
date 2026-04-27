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
}

type PendingScreen = ScreenCacheItem & {
    token: number
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
    screenActivityController: ReturnType<typeof createUiRuntimeScreenActivityController>
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
    screenActivityController,
    performAutomationAction,
}) => {
    const Component = item.child.Component

    return (
        <UiRuntimeProvider
            runtime={runtime}
            automationBridge={automationBridge}
            automationRuntimeId={automationRuntimeId}
            screenActivityController={screenActivityController}
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
}> = ({
    item,
    active,
    testID,
    runtime,
    automationBridge,
    automationRuntimeId,
    performAutomationAction,
    onCommitted,
}) => {
    const screenActivityController = useMemo(
        () => createUiRuntimeScreenActivityController(active),
        [],
    )
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
                screenActivityController={screenActivityController}
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

    const requestedCacheKey = resolution.status === 'ready'
        ? createScreenCacheKey(resolution.containerKey, resolution.child)
        : null
    const requestedCachedScreen = requestedCacheKey
        ? cachedScreens.find(item => item.key === requestedCacheKey)
        : undefined
    const effectivePendingScreen = pendingScreen
        && pendingScreen.key === requestedCacheKey
        && !requestedCachedScreen
        ? pendingScreen
        : null
    const effectiveActiveKey = requestedCachedScreen?.key ?? activeKey
    const activeCachedScreen = effectiveActiveKey
        ? cachedScreens.find(item => item.key === effectiveActiveKey)
        : undefined
    const requestedScreenKey = resolution.status === 'ready'
        ? resolution.child.partKey
        : resolution.status === 'missing-renderer'
            ? resolution.missing.partKey
            : 'empty'
    const visibleScreenKey = effectivePendingScreen
        ? 'loading'
        : activeCachedScreen?.screenKey ?? requestedScreenKey
    const renderedScreens = useMemo(() => {
        if (!effectivePendingScreen || !shouldMountPendingScreen) {
            return cachedScreens
        }
        if (cachedScreens.some(item => item.key === effectivePendingScreen.key)) {
            return cachedScreens
        }
        return [effectivePendingScreen, ...cachedScreens]
    }, [cachedScreens, effectivePendingScreen, shouldMountPendingScreen])

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
            requestedKeyRef.current = null
            pendingScreenRef.current = null
            cacheRecencyRef.current.clear()
            cachedScreensRef.current = []
            setCachedScreens([])
            setPendingScreen(null)
            setShouldMountPendingScreen(false)
            setActiveKey(null)
            return
        }

        const key = createScreenCacheKey(resolution.containerKey, resolution.child)
        const nextItem: ScreenCacheItem = {
            key,
            screenKey: resolution.child.partKey,
            source: resolution.child.source,
            child: resolution.child,
        }
        requestedKeyRef.current = key

        const cached = cachedScreensRef.current.find(item => item.key === key)
        if (cached) {
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
            setActiveKey(key)
            return
        }

        tokenRef.current += 1
        const nextPendingScreen: PendingScreen = {
            ...nextItem,
            token: tokenRef.current,
        }
        pendingScreenRef.current = nextPendingScreen
        setPendingScreen(nextPendingScreen)
        setShouldMountPendingScreen(false)
        setActiveKey(null)
    }, [containerPart, maxCacheSize, resolution, updateCachedScreens])

    useEffect(() => {
        if (!pendingScreen) {
            return undefined
        }
        const pendingToken = pendingScreen.token
        return scheduleAfterPaint(() => {
            if (pendingScreenRef.current?.token === pendingToken) {
                setShouldMountPendingScreen(true)
            }
        })
    }, [pendingScreen])

    const completePendingScreen = useCallback((key: string) => {
        const current = pendingScreenRef.current
        if (!current || current.key !== key || requestedKeyRef.current !== key) {
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
        setActiveKey(key)
    }, [maxCacheSize, updateCachedScreens])

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        automationBridge.clearVisibleContexts(automationTarget, [visibleScreenKey, 'runtime-root', 'overlay', 'alert'])
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
        if (effectivePendingScreen) {
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
        effectivePendingScreen,
        visibleScreenKey,
    ])

    if (resolution.status === 'empty') {
        return (
            <View testID={`ui-base-screen-container:${automationTarget}`} style={{flex: 1}}>
                <EmptyScreen />
            </View>
        )
    }
    if (resolution.status === 'missing-renderer') {
        return (
            <View testID={`ui-base-screen-container:${automationTarget}`} style={{flex: 1}}>
                <MissingRendererScreen
                    containerKey={resolution.containerKey}
                    partKey={resolution.missing.partKey}
                    id={resolution.missing.id}
                    rendererKey={resolution.missing.rendererKey}
                />
            </View>
        )
    }

    return (
        <View testID={`ui-base-screen-container:${automationTarget}`} style={{flex: 1}}>
            {renderedScreens.map(item => (
                <ScreenLifecycleSlot
                    key={item.key}
                    item={item}
                    active={!effectivePendingScreen && item.key === effectiveActiveKey}
                    testID={`ui-base-screen-container:${automationTarget}:slot:${item.key}`}
                    runtime={runtime}
                    automationBridge={automationBridge}
                    automationRuntimeId={automationRuntimeId}
                    performAutomationAction={performAutomationAction}
                    onCommitted={effectivePendingScreen?.key === item.key ? completePendingScreen : undefined}
                />
            ))}
            {effectivePendingScreen ? (
                <LoadingScreen testID={`ui-base-screen-container:${automationTarget}:loading`} />
            ) : null}
        </View>
    )
}
