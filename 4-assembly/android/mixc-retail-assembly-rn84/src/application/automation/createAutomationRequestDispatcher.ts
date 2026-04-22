import {
    createCommand,
    defineCommand,
    type CommandDefinition,
    type KernelRuntimeAppV2,
    type KernelRuntimeV2,
    type RequestQueryResult,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {RequestId} from '@impos2/kernel-base-contracts'
import {selectTopologyDisplayMode} from '@impos2/kernel-base-topology-runtime-v3'
import {
    selectUiOverlays,
    selectUiScreen,
} from '@impos2/kernel-base-ui-runtime-v2'
import {uiRuntimeRootVariables} from '@impos2/ui-base-runtime-react'
import {
    assertValidTarget,
    createActionExecutor,
    createAutomationEventBus,
    createAutomationTrace,
    createQueryEngine,
    createWaitEngine,
    type AutomationMethod,
    type AutomationTarget,
    type AutomationTargetRegistration,
    createAutomationRuntime,
    createSemanticRegistry,
    type SemanticRegistry,
    type SessionHelloResult,
} from '@impos2/ui-base-automation-runtime'
import {nativeScriptExecutor} from '../../turbomodules/scripts'

type RuntimeTarget = Exclude<AutomationTarget, 'all' | 'host'>

interface RuntimeTargetHandle {
    readonly target: RuntimeTarget
    readonly runtime: KernelRuntimeV2
    readonly unregisterTarget: () => void
    readonly unregisterRequestListener: () => void
    readonly unregisterStateListener: () => void
    pendingRequestIds: Set<string>
    requestSnapshots: Map<string, RequestQueryResult>
}

interface JsonRpcRequest {
    readonly jsonrpc?: string
    readonly method: AutomationMethod
    readonly id?: string | number | null
    readonly params?: Record<string, unknown>
}

export interface AssemblyAutomationController {
    readonly runtime: ReturnType<typeof createAutomationRuntime>
    readonly registry: SemanticRegistry
    attachRuntime(input: AutomationTargetRegistration & {runtime: KernelRuntimeV2}): () => void
    dispatchMessage(messageJson: string): Promise<string>
    dispose(): void
}

const PROTOCOL_ERROR_CODE = -32600
const METHOD_NOT_FOUND_CODE = -32601
const INTERNAL_ERROR_CODE = -32603
const METHOD_NOT_AVAILABLE_CODE = -32004
const INVALID_TARGET_CODE = -32010
const WAIT_TIMEOUT_CODE = -32020

const commandDefinitionCache = new Map<string, CommandDefinition<unknown>>()

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const resolveAutomationDisplay = (
    runtime: KernelRuntimeV2,
): 'primary' | 'secondary' => {
    if ((runtime.displayContext.displayIndex ?? 0) > 0) {
        return 'secondary'
    }
    return selectTopologyDisplayMode(runtime.getState()) === 'SECONDARY'
        ? 'secondary'
        : 'primary'
}

const getCurrentScreenSummary = (runtime: KernelRuntimeV2) => {
    const state = runtime.getState()
    const display = resolveAutomationDisplay(runtime)
    const containerKey = display === 'secondary'
        ? uiRuntimeRootVariables.secondaryRootContainer.key
        : uiRuntimeRootVariables.primaryRootContainer.key
    const screen = selectUiScreen(state, containerKey)
    const overlays = selectUiOverlays(state, display === 'secondary' ? 'SECONDARY' : 'PRIMARY')
    return {
        containerKey,
        screen: screen
            ? {
                id: screen.id,
                partKey: screen.partKey,
                rendererKey: screen.rendererKey,
                props: screen.props ?? null,
            }
            : null,
        overlayCount: overlays.length,
    }
}

const toJsonRpcError = (
    id: string | number | null | undefined,
    code: number,
    message: string,
    data?: unknown,
): string => JSON.stringify({
    jsonrpc: '2.0',
    error: {
        code,
        message,
        ...(data === undefined ? {} : {data}),
    },
    id: id ?? null,
})

const toJsonRpcResult = (
    id: string | number | null | undefined,
    result: unknown,
): string => JSON.stringify({
    jsonrpc: '2.0',
    result,
    id: id ?? null,
})

const getCommandDefinition = (
    commandName: string,
): CommandDefinition<Record<string, unknown>> => {
    const cached = commandDefinitionCache.get(commandName)
    if (cached) {
        return cached as CommandDefinition<Record<string, unknown>>
    }
    const definition = defineCommand<Record<string, unknown>>({
        moduleName: commandName.includes('.')
            ? commandName.slice(0, commandName.lastIndexOf('.'))
            : 'assembly.android.mixc-retail-rn84.automation',
        commandName,
        allowNoActor: false,
        allowReentry: true,
    })
    commandDefinitionCache.set(commandName, definition)
    return definition
}

const normalizeRequest = (messageJson: string): JsonRpcRequest => {
    const json = JSON.parse(messageJson) as JsonRpcRequest
    if (json.jsonrpc !== '2.0' || typeof json.method !== 'string') {
        throw new Error('Invalid JSON-RPC request')
    }
    return json
}

const normalizeTarget = (
    method: AutomationMethod,
    target: unknown,
): AutomationTarget => assertValidTarget(
    method,
    typeof target === 'string' ? target as AutomationTarget : 'host',
)

export const createAutomationRequestDispatcher = (input: {
    readonly app: KernelRuntimeAppV2
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly automationEnabled: boolean
    readonly scriptExecutionAvailable?: boolean
    readonly performNodeAction?: Parameters<typeof createActionExecutor>[0]['performNodeAction']
}): AssemblyAutomationController => {
    const automationRuntime = createAutomationRuntime({
        buildProfile: input.buildProfile,
        scriptExecutionAvailable: input.scriptExecutionAvailable,
    })
    const registry = createSemanticRegistry()
    const trace = createAutomationTrace()
    const eventBus = createAutomationEventBus()
    const queryEngine = createQueryEngine({registry, trace})
    const actionExecutor = createActionExecutor({
        registry,
        trace,
        performNodeAction: input.performNodeAction,
    })
    const targetHandles = new Map<RuntimeTarget, RuntimeTargetHandle>()

    const getTargetHandle = (target: RuntimeTarget): RuntimeTargetHandle => {
        const handle = targetHandles.get(target)
        if (!handle) {
            throw new Error(`Target is not attached: ${target}`)
        }
        return handle
    }

    const waitEngine = createWaitEngine({
        trace,
        getPendingRequestCount(target) {
            return getTargetHandle(target).pendingRequestIds.size
        },
        getInFlightActionCount: () => 0,
        getInFlightScriptCount: () => 0,
        subscribeToRuntimeEvents(target, handler) {
            const subscriptionId = eventBus.subscribe({target}, handler)
            return () => {
                eventBus.unsubscribe(subscriptionId)
            }
        },
    })

    const waitUntil = async <T>(
        step: AutomationMethod,
        timeoutMs: number,
        probe: () => T | undefined,
        describeBlocker: () => string,
    ): Promise<T> => {
        const startedAt = Date.now()
        let blocker = describeBlocker()

        while (Date.now() - startedAt < timeoutMs) {
            const result = probe()
            if (result !== undefined) {
                trace.record({
                    step,
                    status: 'ok',
                    input: {timeoutMs},
                    output: result,
                })
                return result
            }
            blocker = describeBlocker()
            await sleep(25)
        }

        trace.record({
            step,
            status: 'failed',
            input: {timeoutMs},
            error: blocker,
        })
        throw Object.assign(new Error(blocker), {code: WAIT_TIMEOUT_CODE})
    }

    const readRuntimeInfo = (target: RuntimeTarget) => {
        const handle = getTargetHandle(target)
        return {
            protocolVersion: automationRuntime.hello().protocolVersion,
            runtimeId: handle.runtime.runtimeId,
            localNodeId: handle.runtime.localNodeId,
            environmentMode: handle.runtime.environmentMode,
            displayContext: handle.runtime.displayContext,
            currentScreen: getCurrentScreenSummary(handle.runtime),
        }
    }

    const attachRuntime = (
        registration: AutomationTargetRegistration & {runtime: KernelRuntimeV2},
    ): (() => void) => {
        const unregisterTarget = automationRuntime.registerTarget(registration)
        const pendingRequestIds = new Set<string>()
        const requestSnapshots = new Map<string, RequestQueryResult>()
        const unregisterRequestListener = registration.runtime.subscribeRequests(request => {
            requestSnapshots.set(request.requestId, request)
            if (request.status === 'RUNNING') {
                pendingRequestIds.add(request.requestId)
            } else {
                pendingRequestIds.delete(request.requestId)
            }
            eventBus.publish({
                topic: 'runtime.requestChanged',
                target: registration.target,
                payload: {
                    requestId: request.requestId,
                    status: request.status,
                },
                createdAt: Date.now(),
            })
        })
        const unregisterStateListener = registration.runtime.subscribeState(() => {
            eventBus.publish({
                topic: 'runtime.stateChanged',
                target: registration.target,
                payload: {
                    currentScreen: getCurrentScreenSummary(registration.runtime),
                },
                createdAt: Date.now(),
            })
        })

        targetHandles.set(registration.target as RuntimeTarget, {
            target: registration.target as RuntimeTarget,
            runtime: registration.runtime,
            unregisterTarget,
            unregisterRequestListener,
            unregisterStateListener,
            pendingRequestIds,
            requestSnapshots,
        })

        eventBus.publish({
            topic: 'runtime.ready',
            target: registration.target as RuntimeTarget,
            payload: readRuntimeInfo(registration.target as RuntimeTarget),
            createdAt: Date.now(),
        })

        return () => {
            targetHandles.delete(registration.target as RuntimeTarget)
            unregisterRequestListener()
            unregisterStateListener()
            unregisterTarget()
            registry.clearTarget(registration.target as RuntimeTarget)
            eventBus.publish({
                topic: 'runtime.disposed',
                target: registration.target as RuntimeTarget,
                payload: {
                    runtimeId: registration.runtime.runtimeId,
                },
                createdAt: Date.now(),
            })
        }
    }

    const listRequests = (target: RuntimeTarget): readonly RequestQueryResult[] => {
        return [...getTargetHandle(target).requestSnapshots.values()]
            .sort((left, right) => right.updatedAt - left.updatedAt)
    }

    const dispatchMessage = async (messageJson: string): Promise<string> => {
        let request: JsonRpcRequest
        try {
            request = normalizeRequest(messageJson)
        } catch (error) {
            return toJsonRpcError(null, PROTOCOL_ERROR_CODE, error instanceof Error ? error.message : String(error))
        }

        const params = request.params ?? {}
        const sessionHello = automationRuntime.hello()

        try {
            switch (request.method) {
                case 'session.hello':
                    return toJsonRpcResult(request.id, sessionHello)
                case 'runtime.getInfo': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host') {
                        return toJsonRpcResult(request.id, {
                            protocolVersion: sessionHello.protocolVersion,
                            buildProfile: sessionHello.buildProfile,
                            productMode: sessionHello.productMode,
                            availableTargets: sessionHello.availableTargets,
                            capabilities: sessionHello.capabilities,
                        })
                    }
                    if (target === 'all') {
                        throw new Error('runtime.getInfo requires a single target')
                    }
                    return toJsonRpcResult(request.id, readRuntimeInfo(target))
                }
                case 'runtime.getState': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('runtime.getState requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, getTargetHandle(target).runtime.getState())
                }
                case 'runtime.selectState': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('runtime.selectState requires a runtime target')
                    }
                    const path = Array.isArray(params.path) ? params.path : []
                    let value: unknown = getTargetHandle(target).runtime.getState()
                    for (const segment of path) {
                        value = value != null && typeof value === 'object'
                            ? (value as Record<string, unknown>)[String(segment)]
                            : undefined
                    }
                    return toJsonRpcResult(request.id, value ?? null)
                }
                case 'runtime.listRequests': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('runtime.listRequests requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, listRequests(target))
                }
                case 'runtime.getRequest': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('runtime.getRequest requires a runtime target')
                    }
                    return toJsonRpcResult(
                        request.id,
                        getTargetHandle(target).runtime.queryRequest(String(params.requestId ?? '') as RequestId) ?? null,
                    )
                }
                case 'runtime.getCurrentScreen': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('runtime.getCurrentScreen requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, getCurrentScreenSummary(getTargetHandle(target).runtime))
                }
                case 'ui.getTree': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('ui.getTree requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, registry.queryNodes({target}))
                }
                case 'ui.queryNodes': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('ui.queryNodes requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, queryEngine.queryNodes({
                        target,
                        testID: typeof params.testID === 'string' ? params.testID : undefined,
                        semanticId: typeof params.semanticId === 'string' ? params.semanticId : undefined,
                        text: typeof params.text === 'string' ? params.text : undefined,
                        role: typeof params.role === 'string' ? params.role : undefined,
                        screen: typeof params.screen === 'string' ? params.screen : undefined,
                    }))
                }
                case 'ui.getNode': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('ui.getNode requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, registry.getNode(target, String(params.nodeId ?? '')) ?? null)
                }
                case 'ui.getFocusedNode': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('ui.getFocusedNode requires a runtime target')
                    }
                    const focused = registry.queryNodes({target}).find(node => node.focused)
                    return toJsonRpcResult(request.id, focused ?? null)
                }
                case 'ui.getBounds': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('ui.getBounds requires a runtime target')
                    }
                    return toJsonRpcResult(
                        request.id,
                        registry.getNode(target, String(params.nodeId ?? ''))?.bounds ?? null,
                    )
                }
                case 'ui.performAction':
                case 'ui.revealNode':
                case 'ui.scroll':
                case 'ui.setValue':
                case 'ui.clearValue':
                case 'ui.submit': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error(`${request.method} requires a runtime target`)
                    }
                    const nodeId = String(params.nodeId ?? '')
                    if ((request.method === 'ui.revealNode' || request.method === 'ui.scroll') && !nodeId) {
                        throw new Error(`${request.method} requires nodeId`)
                    }
                    const action = request.method === 'ui.revealNode'
                        ? 'scroll'
                        : request.method === 'ui.setValue'
                            ? 'changeText'
                            : request.method === 'ui.clearValue'
                                ? 'clear'
                                : request.method === 'ui.submit'
                                    ? 'submit'
                                    : request.method === 'ui.scroll'
                                        ? 'scroll'
                                        : String(params.action ?? 'press')
                    return toJsonRpcResult(request.id, await actionExecutor.performAction({
                        target,
                        nodeId,
                        action: action as any,
                        value: params.value,
                    }))
                }
                case 'wait.forNode': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('wait.forNode requires a runtime target')
                    }
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const testID = typeof params.testID === 'string' ? params.testID : undefined
                    const semanticId = typeof params.semanticId === 'string' ? params.semanticId : undefined
                    const role = typeof params.role === 'string' ? params.role : undefined
                    const text = typeof params.text === 'string' ? params.text : undefined
                    const screen = typeof params.screen === 'string' ? params.screen : undefined
                    return toJsonRpcResult(request.id, await waitUntil(
                        'wait.forNode',
                        timeoutMs,
                        () => {
                            const nodes = registry.queryNodes({target, testID, semanticId, role, text, screen})
                            return nodes[0]
                        },
                        () => `WAIT_FOR_NODE_TIMEOUT:${JSON.stringify({target, testID, semanticId, role, text, screen})}`,
                    ))
                }
                case 'wait.forScreen': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('wait.forScreen requires a runtime target')
                    }
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const screenPartKey = typeof params.partKey === 'string'
                        ? params.partKey
                        : typeof params.screenKey === 'string'
                            ? params.screenKey
                            : undefined
                    if (!screenPartKey) {
                        throw new Error('wait.forScreen requires partKey')
                    }
                    return toJsonRpcResult(request.id, await waitUntil(
                        'wait.forScreen',
                        timeoutMs,
                        () => {
                            const current = getCurrentScreenSummary(getTargetHandle(target).runtime)
                            return current.screen?.partKey === screenPartKey ? current : undefined
                        },
                        () => `WAIT_FOR_SCREEN_TIMEOUT:${screenPartKey}`,
                    ))
                }
                case 'wait.forState': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('wait.forState requires a runtime target')
                    }
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const path = Array.isArray(params.path) ? params.path : []
                    const expected = params.equals
                    return toJsonRpcResult(request.id, await waitUntil(
                        'wait.forState',
                        timeoutMs,
                        () => {
                            let value: unknown = getTargetHandle(target).runtime.getState()
                            for (const segment of path) {
                                value = value != null && typeof value === 'object'
                                    ? (value as Record<string, unknown>)[String(segment)]
                                    : undefined
                            }
                            return JSON.stringify(value ?? null) === JSON.stringify(expected)
                                ? {path, value: value ?? null}
                                : undefined
                        },
                        () => `WAIT_FOR_STATE_TIMEOUT:${JSON.stringify({path, expected})}`,
                    ))
                }
                case 'wait.forRequest': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('wait.forRequest requires a runtime target')
                    }
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const requestId = typeof params.requestId === 'string' ? params.requestId : undefined
                    const expectedStatus = typeof params.status === 'string' ? params.status : undefined
                    if (!requestId) {
                        throw new Error('wait.forRequest requires requestId')
                    }
                    return toJsonRpcResult(request.id, await waitUntil(
                        'wait.forRequest',
                        timeoutMs,
                        () => {
                            const requestSnapshot = getTargetHandle(target).requestSnapshots.get(requestId)
                            if (!requestSnapshot) {
                                return undefined
                            }
                            if (expectedStatus && requestSnapshot.status !== expectedStatus) {
                                return undefined
                            }
                            return requestSnapshot
                        },
                        () => `WAIT_FOR_REQUEST_TIMEOUT:${JSON.stringify({requestId, expectedStatus})}`,
                    ))
                }
                case 'wait.forIdle': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('wait.forIdle requires a runtime target')
                    }
                    return toJsonRpcResult(request.id, await waitEngine.forIdle({
                        target,
                        timeoutMs: Number(params.timeoutMs ?? 3_000),
                    }))
                }
                case 'events.subscribe': {
                    const eventTarget = typeof params.target === 'string'
                        ? params.target as AutomationTarget
                        : undefined
                    if (eventTarget === 'all') {
                        throw new Error('events.subscribe does not allow all target')
                    }
                    const topic = typeof params.topic === 'string' ? params.topic : undefined
                    const subscriptionId = eventBus.subscribe({
                        target: eventTarget as Exclude<AutomationTarget, 'all'> | undefined,
                        topic: topic as any,
                        sessionId: typeof params.sessionId === 'string' ? params.sessionId : undefined,
                    }, () => {})
                    return toJsonRpcResult(request.id, {
                        subscriptionId,
                        mode: 'pull-latest-only',
                    })
                }
                case 'events.unsubscribe':
                    return toJsonRpcResult(request.id, {
                        ok: eventBus.unsubscribe(String(params.subscriptionId ?? '')),
                    })
                case 'automation.getLastTrace':
                    return toJsonRpcResult(request.id, trace.getLastTrace() ?? null)
                case 'automation.getTraceHistory':
                    return toJsonRpcResult(
                        request.id,
                        trace.getTraceHistory(
                            typeof params.limit === 'number' ? params.limit : undefined,
                        ),
                    )
                case 'automation.clearTrace':
                    trace.clear()
                    return toJsonRpcResult(request.id, {ok: true})
                case 'command.dispatch': {
                    const target = normalizeTarget(request.method, params.target)
                    if (target === 'host' || target === 'all') {
                        throw new Error('command.dispatch requires a runtime target')
                    }
                    const commandName = String(params.commandName ?? '')
                    const payload = (params.payload ?? {}) as Record<string, unknown>
                    const result = await getTargetHandle(target).runtime.dispatchCommand(
                        createCommand(getCommandDefinition(commandName), payload),
                    )
                    return toJsonRpcResult(request.id, result)
                }
                case 'scripts.execute': {
                    if (sessionHello.productMode || !sessionHello.scriptExecutionAvailable || !input.automationEnabled) {
                        return toJsonRpcError(request.id, METHOD_NOT_AVAILABLE_CODE, 'scripts.execute is not available')
                    }
                    trace.record({
                        step: 'scripts.execute',
                        status: 'ok',
                        input: params,
                    })
                    const result = await nativeScriptExecutor.execute({
                        source: String(params.source ?? ''),
                        params: typeof params.params === 'object' && params.params != null
                            ? params.params as Record<string, unknown>
                            : undefined,
                        globals: typeof params.globals === 'object' && params.globals != null
                            ? params.globals as Record<string, unknown>
                            : undefined,
                        timeoutMs: Number(params.timeoutMs ?? 5_000),
                    })
                    trace.record({
                        step: 'scripts.execute',
                        status: 'ok',
                        output: result,
                    })
                    return toJsonRpcResult(request.id, result)
                }
                default:
                    return toJsonRpcError(request.id, METHOD_NOT_FOUND_CODE, `Unknown automation method: ${request.method}`)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('target')) {
                return toJsonRpcError(request.id, INVALID_TARGET_CODE, message)
            }
            if ((error as {code?: number}).code === WAIT_TIMEOUT_CODE) {
                return toJsonRpcError(request.id, WAIT_TIMEOUT_CODE, message)
            }
            trace.record({
                step: request.method,
                status: 'failed',
                input: params,
                error: message,
            })
            return toJsonRpcError(request.id, INTERNAL_ERROR_CODE, message)
        }
    }

    return {
        runtime: automationRuntime,
        registry,
        attachRuntime,
        dispatchMessage,
        dispose() {
            targetHandles.forEach(handle => {
                handle.unregisterRequestListener()
                handle.unregisterStateListener()
                handle.unregisterTarget()
            })
            targetHandles.clear()
            registry.clearTarget('primary')
            registry.clearTarget('secondary')
            eventBus.clear()
            trace.clear()
        },
    }
}
