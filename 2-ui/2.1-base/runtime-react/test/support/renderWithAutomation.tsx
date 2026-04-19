import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import {Provider} from 'react-redux'
import type {EnhancedStore} from '@reduxjs/toolkit'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createActionExecutor,
    createAutomationJsonRpcClient,
    createAutomationRuntime,
    createAutomationTrace,
    createQueryEngine,
    createSemanticRegistry,
    createWaitEngine,
    type AutomationMethod,
    type AutomationNodeAction,
    type AutomationNodeSnapshot,
} from '../../../ui-automation-runtime/src'
import {
    UiRuntimeProvider,
    type RuntimeReactAutomationNodeRegistration,
    type UiRuntimeProviderProps,
} from '../../src'

type TestRendererNode = TestRenderer.ReactTestInstance

type SupportedMethod =
    | 'session.hello'
    | 'runtime.getState'
    | 'runtime.selectState'
    | 'ui.getTree'
    | 'ui.queryNodes'
    | 'ui.getNode'
    | 'ui.performAction'
    | 'ui.setValue'
    | 'ui.clearValue'
    | 'ui.submit'
    | 'wait.forNode'
    | 'wait.forIdle'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isTestRendererNode = (value: unknown): value is TestRendererNode =>
    typeof value === 'object' && value != null && 'props' in value && 'children' in value

const isPrimitiveChild = (value: unknown): boolean =>
    typeof value === 'string' || typeof value === 'number'

const readNodeText = (node: TestRendererNode): string | undefined => {
    const chunks: string[] = []
    const visit = (child: unknown) => {
        if (typeof child === 'string' || typeof child === 'number') {
            chunks.push(String(child))
            return
        }
        if (isTestRendererNode(child)) {
            child.children.forEach(visit)
        }
    }
    node.children.forEach(visit)
    const text = chunks.join('').trim()
    return text.length > 0 ? text : undefined
}

const inferAvailableActions = (props: Record<string, unknown>): readonly AutomationNodeAction[] => {
    const actions = new Set<AutomationNodeAction>()
    if (
        typeof props.onPress === 'function'
        || typeof props.onClick === 'function'
        || typeof props.onTouchEnd === 'function'
    ) {
        actions.add('press')
    }
    if (typeof props.onLongPress === 'function') {
        actions.add('longPress')
    }
    if (typeof props.onChangeText === 'function') {
        actions.add('changeText')
        actions.add('clear')
    }
    if (typeof props.onSubmitEditing === 'function') {
        actions.add('submit')
    }
    return [...actions]
}

const inferRole = (props: Record<string, unknown>): string | undefined => {
    if (typeof props.accessibilityRole === 'string') {
        return props.accessibilityRole
    }
    if (typeof props.onChangeText === 'function') {
        return 'input'
    }
    if (
        typeof props.onPress === 'function'
        || typeof props.onClick === 'function'
        || typeof props.onTouchEnd === 'function'
    ) {
        return 'button'
    }
    return undefined
}

const inferInteractionPriority = (props: Record<string, unknown>): number => {
    if (typeof props.onPress === 'function') {
        return 100
    }
    if (typeof props.onLongPress === 'function') {
        return 90
    }
    if (typeof props.onChangeText === 'function') {
        return 80
    }
    if (typeof props.onSubmitEditing === 'function') {
        return 70
    }
    if (typeof props.onClick === 'function') {
        return 60
    }
    if (typeof props.onTouchEnd === 'function') {
        return 50
    }
    return 0
}

type AutomationPointer = {
    pageX: number
    pageY: number
    clientX: number
    clientY: number
}

type AutomationPressEvent = {
    nativeEvent: AutomationPointer & {
        touches: readonly AutomationPointer[]
        changedTouches: readonly AutomationPointer[]
    }
    pageX: number
    pageY: number
    clientX: number
    clientY: number
    touches: readonly AutomationPointer[]
    changedTouches: readonly AutomationPointer[]
    stopPropagation(): void
    preventDefault(): void
}

const createAutomationPressEvent = (): AutomationPressEvent => {
    const point: AutomationPointer = {
        pageX: 12,
        pageY: 12,
        clientX: 12,
        clientY: 12,
    }
    return {
        nativeEvent: {
            ...point,
            touches: [point],
            changedTouches: [point],
        },
        ...point,
        touches: [point],
        changedTouches: [point],
        stopPropagation() {},
        preventDefault() {},
    }
}

const createNodeAction = (
    props: Record<string, unknown>,
): ((action: {action: AutomationNodeAction; value?: unknown}) => Promise<unknown>) | undefined => {
    const onPress = typeof props.onPress === 'function' ? props.onPress as () => unknown : undefined
    const onClick = typeof props.onClick === 'function'
        ? props.onClick as (event?: AutomationPressEvent) => unknown
        : undefined
    const onTouchEnd = typeof props.onTouchEnd === 'function'
        ? props.onTouchEnd as (event?: AutomationPressEvent) => unknown
        : undefined
    const onLongPress = typeof props.onLongPress === 'function' ? props.onLongPress as () => unknown : undefined
    const onChangeText = typeof props.onChangeText === 'function'
        ? props.onChangeText as (value: string) => unknown
        : undefined
    const onSubmitEditing = typeof props.onSubmitEditing === 'function'
        ? props.onSubmitEditing as (event: {nativeEvent: {text: string}}) => unknown
        : undefined

    if (!onPress && !onClick && !onTouchEnd && !onLongPress && !onChangeText && !onSubmitEditing) {
        return undefined
    }

    return async input => {
        switch (input.action) {
            case 'press':
                if (onPress) {
                    return await onPress()
                }
                if (onClick) {
                    return await onClick(createAutomationPressEvent())
                }
                return await onTouchEnd?.(createAutomationPressEvent())
            case 'longPress':
                return await onLongPress?.()
            case 'changeText':
                return await onChangeText?.(String(input.value ?? ''))
            case 'clear':
                return await onChangeText?.('')
            case 'submit':
                return await onSubmitEditing?.({
                    nativeEvent: {
                        text: String(props.value ?? ''),
                    },
                })
            default:
                return undefined
        }
    }
}

export interface RenderWithAutomationResult {
    readonly tree: TestRenderer.ReactTestRenderer
    readonly client: ReturnType<typeof createAutomationJsonRpcClient>
    readonly trace: ReturnType<typeof createAutomationTrace>
    refresh(): void
    act(run: () => void | Promise<void>): Promise<void>
    dispatch(run: () => void | Promise<void>): Promise<void>
    dispatchCommand(command: unknown): Promise<unknown>
    update(element: React.ReactElement): Promise<void>
    unmount(): Promise<void>
    press(testID: string): Promise<void>
    changeText(testID: string, value: string): Promise<void>
    clearValue(testID: string): Promise<void>
    typeVirtualValue(fieldNodeId: string, value: string, options?: {clear?: boolean}): Promise<void>
    getNode(testID: string): Promise<AutomationNodeSnapshot | null>
    getText(testID: string): Promise<string | undefined>
    queryNodes(testID: string): Promise<readonly AutomationNodeSnapshot[]>
    queryNodesByText(text: string): Promise<readonly AutomationNodeSnapshot[]>
    queryNodesByTextContains(text: string): Promise<readonly AutomationNodeSnapshot[]>
    waitForNode(testID: string, timeoutMs?: number): Promise<AutomationNodeSnapshot>
    waitForText(text: string, timeoutMs?: number): Promise<AutomationNodeSnapshot>
    waitForIdle(timeoutMs?: number): Promise<{ok: boolean; blocker?: string}>
    getState(path?: readonly string[]): Promise<unknown>
}

const resolveNodeForTextEntry = async (
    client: ReturnType<typeof createAutomationJsonRpcClient>,
    target: 'primary' | 'secondary',
    testID: string,
): Promise<AutomationNodeSnapshot> => {
    const node = await client.call<AutomationNodeSnapshot | null>('ui.getNode', {
        target,
        nodeId: testID,
    })
    if (!node) {
        throw new Error(`NODE_NOT_FOUND:${testID}`)
    }
    if (node.nodeId.startsWith('ui-base-virtual-field:')) {
        throw new Error(`VIRTUAL_INPUT_REQUIRES_KEYBOARD:${testID}`)
    }
    if (!node.availableActions.includes('changeText')) {
        throw new Error(`NODE_NOT_TEXT_EDITABLE:${testID}`)
    }
    return node
}

export const renderWithAutomation = (
    element: React.ReactElement,
    store: EnhancedStore,
    runtime: KernelRuntimeV2,
    providerProps: Omit<UiRuntimeProviderProps, 'runtime' | 'children'> = {},
): RenderWithAutomationResult => {
    const target = (runtime.displayContext.displayIndex ?? 0) > 0 ? 'secondary' : 'primary'
    const registry = createSemanticRegistry()
    const trace = createAutomationTrace()
    const queryEngine = createQueryEngine({registry, trace})
    const handlers = new Map<string, ReturnType<typeof createNodeAction>>()
    const explicitNodeUnregisters = new Map<string, () => void>()
    const fallbackNodeUnregisters = new Map<string, () => void>()
    const actionExecutor = createActionExecutor({
        registry,
        trace,
        async performNodeAction(input) {
            const handler = handlers.get(input.nodeId)
            return await handler?.({
                action: input.action,
                value: input.value,
            })
        },
    })
    const waitEngine = createWaitEngine({
        trace,
        getPendingRequestCount: () => 0,
        getInFlightActionCount: () => 0,
        getInFlightScriptCount: () => 0,
        subscribeToRuntimeEvents: () => () => {},
        quietWindowMs: 5,
    })
    const automationRuntime = createAutomationRuntime({
        buildProfile: 'test',
        scriptExecutionAvailable: false,
    })
    automationRuntime.registerTarget({
        target,
        runtimeId: runtime.runtimeId,
    })

    const registerExplicitNode = (node: RuntimeReactAutomationNodeRegistration): (() => void) => {
        const key = node.nodeId
        explicitNodeUnregisters.get(key)?.()
        const fallbackUnregister = fallbackNodeUnregisters.get(key)
        if (fallbackUnregister) {
            fallbackUnregister()
            fallbackNodeUnregisters.delete(key)
        }
        const fallbackHandler = createNodeAction({
            onPress: undefined,
        })
        if (node.onAutomationAction) {
            handlers.set(key, async input => await node.onAutomationAction?.({
                target: node.target,
                nodeId: node.nodeId,
                action: input.action,
                value: input.value,
            }))
        } else if (fallbackHandler) {
            handlers.set(key, fallbackHandler)
        } else {
            handlers.delete(key)
        }
        const unregister = registry.registerNode({
            ...node,
            target: node.target,
            availableActions: [...node.availableActions] as readonly AutomationNodeAction[],
        })
        explicitNodeUnregisters.set(key, unregister)
        return () => {
            handlers.delete(key)
            explicitNodeUnregisters.delete(key)
            unregister()
        }
    }

    const automationBridge: NonNullable<UiRuntimeProviderProps['automationBridge']> = {
        registerNode: registerExplicitNode,
        updateNode(nodeTarget, nodeId, patch) {
            registry.updateNode(nodeTarget, nodeId, {
                ...patch,
                availableActions: patch.availableActions
                    ? [...patch.availableActions] as readonly AutomationNodeAction[]
                    : undefined,
            })
            if (patch.onAutomationAction) {
                handlers.set(nodeId, async input => await patch.onAutomationAction?.({
                    target: nodeTarget,
                    nodeId,
                    action: input.action,
                    value: input.value,
                }))
            }
        },
        clearVisibleContexts(nodeTarget, visibleContextKeys) {
            registry.clearScreenContext(nodeTarget, visibleContextKeys)
        },
        clearTarget(nodeTarget) {
            registry.clearTarget(nodeTarget)
            for (const key of [...explicitNodeUnregisters.keys()]) {
                if ((registry.getNode(nodeTarget, key)?.target ?? nodeTarget) === nodeTarget) {
                    explicitNodeUnregisters.delete(key)
                    handlers.delete(key)
                }
            }
        },
    }

    const wrap = (child: React.ReactElement) => (
        <Provider store={store}>
            <UiRuntimeProvider
                runtime={runtime}
                automationBridge={providerProps.automationBridge ?? automationBridge}
                automationRuntimeId={providerProps.automationRuntimeId ?? runtime.runtimeId}
                performAutomationAction={providerProps.performAutomationAction}
            >
                {child}
            </UiRuntimeProvider>
        </Provider>
    )

    let tree!: TestRenderer.ReactTestRenderer
    act(() => {
        tree = TestRenderer.create(wrap(element))
    })

    const rebuildRegistry = () => {
        for (const unregister of fallbackNodeUnregisters.values()) {
            unregister()
        }
        fallbackNodeUnregisters.clear()
        const candidates = new Map<string, {
            snapshot: AutomationNodeSnapshot
            handler?: ReturnType<typeof createNodeAction>
            score: number
        }>()

        const registerCandidate = (
            nodeId: string,
            snapshot: AutomationNodeSnapshot,
            score: number,
            handler?: ReturnType<typeof createNodeAction>,
        ) => {
            const previous = candidates.get(nodeId)
            if (!previous || score > previous.score) {
                candidates.set(nodeId, {
                    snapshot,
                    handler,
                    score,
                })
            }
        }

        const visit = (node: TestRendererNode, path: string) => {
            const props = node.props as Record<string, unknown>
            const testID = typeof props.testID === 'string' ? props.testID : undefined
            if (testID) {
                const actionHandler = createNodeAction(props)
                const snapshot: AutomationNodeSnapshot = {
                    target,
                    runtimeId: runtime.runtimeId,
                    screenKey: 'test-renderer',
                    mountId: testID,
                    nodeId: testID,
                    testID,
                    semanticId: testID,
                    role: inferRole(props),
                    text: readNodeText(node)
                        ?? (typeof props.value === 'string' ? props.value : undefined)
                        ?? (typeof props.placeholder === 'string' ? props.placeholder : undefined),
                    value: props.value,
                    visible: true,
                    enabled: props.disabled !== true,
                    focused: props.focused === true,
                    availableActions: inferAvailableActions(props),
                }
                const score = inferInteractionPriority(props) * 100
                    + snapshot.availableActions.length * 10
                    + (snapshot.text ? 1 : 0)
                registerCandidate(testID, snapshot, score, actionHandler)
            }

            const text = readNodeText(node)
            const isLeafTextNode = node.children.length > 0 && node.children.every(isPrimitiveChild)
            if (text && !testID && isLeafTextNode) {
                const nodeId = `__text:${path}`
                registerCandidate(nodeId, {
                    target,
                    runtimeId: runtime.runtimeId,
                    screenKey: 'test-renderer',
                    mountId: nodeId,
                    nodeId,
                    semanticId: nodeId,
                    role: 'text',
                    text,
                    visible: true,
                    enabled: true,
                    availableActions: [],
                }, 1)
            }

            node.children.forEach((child, index) => {
                if (isTestRendererNode(child)) {
                    visit(child, `${path}.${index}`)
                }
            })
        }

        visit(tree.root, 'root')
        for (const [testID, candidate] of candidates.entries()) {
            if (registry.getNode(target, testID) && !registry.getNode(target, testID)?.stale) {
                continue
            }
            if (candidate.handler) {
                handlers.set(testID, candidate.handler)
            }
            fallbackNodeUnregisters.set(testID, registry.registerNode(candidate.snapshot))
        }
    }

    rebuildRegistry()

    const dispatchMessage = async (messageJson: string): Promise<string> => {
        rebuildRegistry()
        const request = JSON.parse(messageJson) as {
            readonly id?: string | number | null
            readonly method: SupportedMethod | AutomationMethod
            readonly params?: Record<string, unknown>
        }
        const params = request.params ?? {}
        const success = (result: unknown) => JSON.stringify({
            jsonrpc: '2.0',
            id: request.id ?? null,
            result,
        })
        const failure = (message: string) => JSON.stringify({
            jsonrpc: '2.0',
            id: request.id ?? null,
            error: {
                code: -32603,
                message,
            },
        })

        try {
            switch (request.method) {
                case 'session.hello':
                    return success(automationRuntime.hello())
                case 'runtime.getState':
                    return success(runtime.getState())
                case 'runtime.selectState': {
                    const path = Array.isArray(params.path) ? params.path : []
                    let value: unknown = runtime.getState()
                    for (const segment of path) {
                        value = value != null && typeof value === 'object'
                            ? (value as Record<string, unknown>)[String(segment)]
                            : undefined
                    }
                    return success(value ?? null)
                }
                case 'ui.getTree':
                    return success(registry.queryNodes({target}))
                case 'ui.queryNodes':
                    return success(queryEngine.queryNodes({
                        target,
                        testID: typeof params.testID === 'string' ? params.testID : undefined,
                        semanticId: typeof params.semanticId === 'string' ? params.semanticId : undefined,
                        text: typeof params.text === 'string' ? params.text : undefined,
                        role: typeof params.role === 'string' ? params.role : undefined,
                        screen: typeof params.screen === 'string' ? params.screen : undefined,
                    }))
                case 'ui.getNode':
                    return success(registry.getNode(target, String(params.nodeId ?? '')) ?? null)
                case 'ui.performAction':
                case 'ui.setValue':
                case 'ui.clearValue':
                case 'ui.submit': {
                    const action = request.method === 'ui.setValue'
                        ? 'changeText'
                        : request.method === 'ui.clearValue'
                            ? 'clear'
                            : request.method === 'ui.submit'
                                ? 'submit'
                                : String(params.action ?? 'press')
                    let result: unknown
                    await act(async () => {
                        result = await actionExecutor.performAction({
                            target,
                            nodeId: String(params.nodeId ?? ''),
                            action: action as AutomationNodeAction,
                            value: params.value,
                        })
                        await sleep(0)
                    })
                    rebuildRegistry()
                    return success(result)
                }
                case 'wait.forNode': {
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const startedAt = Date.now()
                    while (Date.now() - startedAt < timeoutMs) {
                        rebuildRegistry()
                        const nodes = queryEngine.queryNodes({
                            target,
                            testID: typeof params.testID === 'string' ? params.testID : undefined,
                            semanticId: typeof params.semanticId === 'string' ? params.semanticId : undefined,
                            text: typeof params.text === 'string' ? params.text : undefined,
                            role: typeof params.role === 'string' ? params.role : undefined,
                            screen: typeof params.screen === 'string' ? params.screen : undefined,
                        })
                        if (nodes[0]) {
                            return success(nodes[0])
                        }
                        await sleep(10)
                    }
                    return failure('WAIT_FOR_NODE_TIMEOUT')
                }
                case 'wait.forIdle':
                    return success(await waitEngine.forIdle({
                        target,
                        timeoutMs: Number(params.timeoutMs ?? 200),
                    }))
                default:
                    return failure(`Unsupported automation method in test renderer host: ${request.method}`)
            }
        } catch (error) {
            return failure(error instanceof Error ? error.message : String(error))
        }
    }

    const client = createAutomationJsonRpcClient({dispatchMessage})

    return {
        tree,
        client,
        trace,
        refresh: rebuildRegistry,
        async act(run) {
            await act(async () => {
                await run()
                await sleep(0)
            })
            rebuildRegistry()
        },
        async dispatch(run) {
            await act(async () => {
                await run()
                await sleep(0)
            })
            rebuildRegistry()
        },
        async dispatchCommand(command) {
            let result: unknown
            await act(async () => {
                result = await runtime.dispatchCommand(command as never)
                await sleep(0)
            })
            rebuildRegistry()
            return result
        },
        async update(nextElement) {
            await act(async () => {
                tree.update(wrap(nextElement))
            })
            rebuildRegistry()
        },
        async unmount() {
            await act(async () => {
                tree.unmount()
                await sleep(0)
            })
            rebuildRegistry()
        },
        async press(testID) {
            await client.call('ui.performAction', {
                target,
                nodeId: testID,
                action: 'press',
            })
        },
        async changeText(testID, value) {
            await resolveNodeForTextEntry(client, target, testID)
            await client.call('ui.setValue', {
                target,
                nodeId: testID,
                value,
            })
        },
        async clearValue(testID) {
            const node = await resolveNodeForTextEntry(client, target, testID)
            if (!node.availableActions.includes('clear')) {
                throw new Error(`NODE_NOT_CLEARABLE:${testID}`)
            }
            await client.call('ui.clearValue', {
                target,
                nodeId: testID,
            })
        },
        async typeVirtualValue(fieldNodeId, value, options = {}) {
            await client.call('ui.performAction', {
                target,
                nodeId: fieldNodeId,
                action: 'press',
            })
            await client.call('wait.forNode', {
                target,
                testID: 'ui-base-virtual-keyboard',
                timeoutMs: 3_000,
            })
            if (options.clear !== false) {
                await client.call('ui.performAction', {
                    target,
                    nodeId: 'ui-base-virtual-keyboard:key:clear',
                    action: 'press',
                })
            }
            for (const key of value.toUpperCase().split('')) {
                await client.call('ui.performAction', {
                    target,
                    nodeId: `ui-base-virtual-keyboard:key:${key}`,
                    action: 'press',
                })
            }
            await client.call('ui.performAction', {
                target,
                nodeId: 'ui-base-virtual-keyboard:key:enter',
                action: 'press',
            })
        },
        async getNode(testID) {
            return await client.call<AutomationNodeSnapshot | null>('ui.getNode', {
                target,
                nodeId: testID,
            })
        },
        async getText(testID) {
            return (await client.call<AutomationNodeSnapshot | null>('ui.getNode', {
                target,
                nodeId: testID,
            }))?.text
        },
        async queryNodes(testID) {
            return await client.call<readonly AutomationNodeSnapshot[]>('ui.queryNodes', {
                target,
                testID,
            })
        },
        async queryNodesByText(text) {
            return await client.call<readonly AutomationNodeSnapshot[]>('ui.queryNodes', {
                target,
                text,
            })
        },
        async queryNodesByTextContains(text) {
            const nodes = await client.call<readonly AutomationNodeSnapshot[]>('ui.getTree', {
                target,
            })
            return nodes.filter(node => node.text?.includes(text))
        },
        async waitForNode(testID, timeoutMs = 3_000) {
            return await client.call<AutomationNodeSnapshot>('wait.forNode', {
                target,
                testID,
                timeoutMs,
            })
        },
        async waitForText(text, timeoutMs = 3_000) {
            return await client.call<AutomationNodeSnapshot>('wait.forNode', {
                target,
                text,
                timeoutMs,
            })
        },
        async waitForIdle(timeoutMs = 200) {
            return await client.call<{ok: boolean; blocker?: string}>('wait.forIdle', {
                target,
                timeoutMs,
            })
        },
        async getState(path = []) {
            return await client.call('runtime.selectState', {
                target,
                path,
            })
        },
    }
}
