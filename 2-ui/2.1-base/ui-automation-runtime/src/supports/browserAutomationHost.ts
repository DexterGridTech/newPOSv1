import {createAutomationRuntime} from '../application/createAutomationRuntime'
import {createAutomationTrace} from '../foundations/automationTrace'
import type {
    AutomationMethod,
    AutomationTarget,
} from '../types/protocol'

const AUTOMATION_HOST_GLOBAL_KEY = '__IMPOS_AUTOMATION__'
const INTERNAL_ERROR_CODE = -32603
const METHOD_NOT_FOUND_CODE = -32601
const METHOD_NOT_AVAILABLE_CODE = -32004
const WAIT_TIMEOUT_CODE = -32020

type BrowserAutomationTarget = Exclude<AutomationTarget, 'all' | 'host'>

type UnknownRecord = Record<string, unknown>

type DomLikeElement = {
    value?: string
    disabled?: boolean
    innerText?: string
    textContent?: string | null
    isConnected?: boolean
    tagName?: string
    nodeName?: string
    click?: () => void
    focus?: () => void
    dispatchEvent?: (event: unknown) => boolean
    getAttribute?: (name: string) => string | null
}

type DomLikeDocument = {
    body?: unknown
    activeElement?: unknown
    querySelector?: (selector: string) => unknown
    querySelectorAll?: (selector: string) => ArrayLike<unknown>
}

type DomLikeMutationObserver = {
    disconnect: () => void
    observe: (target: unknown, options: UnknownRecord) => void
}

type BrowserSupportGlobals = typeof globalThis & {
    document?: DomLikeDocument
    getComputedStyle?: (element: unknown) => {
        display?: string
        visibility?: string
        opacity?: string
    }
    MutationObserver?: new (callback: () => void) => DomLikeMutationObserver
    Event?: new (type: string, init?: UnknownRecord) => unknown
    MouseEvent?: new (type: string, init?: UnknownRecord) => unknown
    KeyboardEvent?: new (type: string, init?: UnknownRecord) => unknown
    CSS?: {
        escape?: (value: string) => string
    }
}

interface BrowserJsonRpcRequest {
    readonly jsonrpc?: string
    readonly id?: string | number | null
    readonly method: AutomationMethod
    readonly params?: Record<string, unknown>
}

interface BrowserAutomationNodeSnapshot {
    readonly target: BrowserAutomationTarget
    readonly runtimeId: string
    readonly screenKey: string
    readonly mountId: string
    readonly nodeId: string
    readonly testID: string
    readonly semanticId: string
    readonly role?: string
    readonly text?: string
    readonly value?: unknown
    readonly visible: boolean
    readonly enabled: boolean
    readonly focused?: boolean
    readonly availableActions: readonly string[]
}

type BrowserGlobalScope = typeof globalThis & {
    [AUTOMATION_HOST_GLOBAL_KEY]?: BrowserAutomationGlobal
}

export interface BrowserAutomationGlobal {
    readonly started: boolean
    readonly runtimeId: string
    dispatchMessage(messageJson: string): Promise<string>
}

export interface BrowserAutomationHost extends BrowserAutomationGlobal {
    start(): void
    stop(): void
}

export interface CreateBrowserAutomationHostOptions {
    readonly autoStart?: boolean
    readonly buildProfile?: 'debug' | 'internal' | 'product' | 'test'
    readonly scriptExecutionAvailable?: boolean
    readonly runtimeId?: string
    readonly target?: BrowserAutomationTarget
    readonly quietWindowMs?: number
    readonly getRuntimeState?: () => unknown
}

const browserGlobals = globalThis as BrowserSupportGlobals

const asDomElement = (value: unknown): DomLikeElement | null =>
    value != null && typeof value === 'object'
        ? value as DomLikeElement
        : null

const getDocument = (): DomLikeDocument | undefined => browserGlobals.document

const hasDocument = (): boolean => getDocument() != null

const getTagName = (element: DomLikeElement): string =>
    (element.tagName ?? element.nodeName ?? '').toLowerCase()

const getAttribute = (element: DomLikeElement, name: string): string | null =>
    typeof element.getAttribute === 'function'
        ? element.getAttribute(name)
        : null

const isInputElement = (element: DomLikeElement): boolean =>
    getTagName(element) === 'input'
        || typeof element.value === 'string'
        || getAttribute(element, 'role') === 'textbox'
        || getAttribute(element, 'data-automation-role') === 'input'
        || getAttribute(element, 'type') === 'text'
        || getAttribute(element, 'type') === 'password'
        || getAttribute(element, 'type') === 'number'

const isTextAreaElement = (element: DomLikeElement): boolean =>
    getTagName(element) === 'textarea'
        || getAttribute(element, 'data-automation-role') === 'textarea'
        || getAttribute(element, 'role') === 'textbox-multiline'
        || getAttribute(element, 'data-testid')?.includes('textarea') === true

const isSelectElement = (element: DomLikeElement): boolean =>
    getTagName(element) === 'select'
        || getAttribute(element, 'data-automation-role') === 'select'
        || getAttribute(element, 'role') === 'combobox'

const isButtonElement = (element: DomLikeElement): boolean =>
    getTagName(element) === 'button'
        || getAttribute(element, 'role') === 'button'
        || getAttribute(element, 'type') === 'button'
        || getAttribute(element, 'type') === 'submit'
        || typeof element.click === 'function'

const isFormElement = (element: DomLikeElement): boolean =>
    getTagName(element) === 'form'
        || getAttribute(element, 'role') === 'form'
        || getAttribute(element, 'data-automation-role') === 'form'

const isElementVisible = (element: DomLikeElement): boolean => {
    if (!hasDocument() || element.isConnected === false) {
        return false
    }
    const style = typeof browserGlobals.getComputedStyle === 'function'
        ? browserGlobals.getComputedStyle(element)
        : {display: 'block', visibility: 'visible', opacity: '1'}
    return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
}

const readElementValue = (element: DomLikeElement): unknown => {
    if (isInputElement(element) || isTextAreaElement(element) || isSelectElement(element)) {
        return element.value
    }
    return undefined
}

const readElementText = (element: DomLikeElement): string | undefined => {
    const value = readElementValue(element)
    if (typeof value === 'string' && value.length > 0) {
        return value
    }
    const text = element.innerText?.trim()
        || element.textContent?.trim()
        || getAttribute(element, 'aria-label')?.trim()
        || getAttribute(element, 'placeholder')?.trim()
        || undefined
    return text && text.length > 0 ? text : undefined
}

const inferNodeRole = (element: DomLikeElement): string | undefined => {
    if (isInputElement(element) || isTextAreaElement(element)) {
        return 'input'
    }
    return getAttribute(element, 'role')
        ?? (isButtonElement(element) ? 'button' : undefined)
}

const inferAvailableActions = (element: DomLikeElement): readonly string[] => {
    const actions = new Set<string>(['press'])
    if (isInputElement(element) || isTextAreaElement(element)) {
        actions.add('changeText')
        actions.add('clear')
    }
    if (isFormElement(element) || isButtonElement(element)) {
        actions.add('submit')
    }
    return [...actions]
}

const toNodeSnapshot = (
    input: {
        readonly target: BrowserAutomationTarget
        readonly runtimeId: string
        readonly element: DomLikeElement
        readonly nodeId: string
    },
): BrowserAutomationNodeSnapshot => {
    const testID = getAttribute(input.element, 'data-testid') ?? input.nodeId
    return {
        target: input.target,
        runtimeId: input.runtimeId,
        screenKey: 'browser-dom',
        mountId: input.nodeId,
        nodeId: input.nodeId,
        testID,
        semanticId: testID,
        role: inferNodeRole(input.element),
        text: readElementText(input.element),
        value: readElementValue(input.element),
        visible: isElementVisible(input.element),
        enabled: input.element.disabled !== true,
        focused: getDocument()?.activeElement === input.element,
        availableActions: inferAvailableActions(input.element),
    }
}

const queryByTestId = (testID: string): DomLikeElement | null => {
    const document = getDocument()
    if (!document || typeof document.querySelector !== 'function') {
        return null
    }
    const escaped = typeof browserGlobals.CSS?.escape === 'function'
        ? browserGlobals.CSS.escape(testID)
        : testID.replaceAll('"', '\\"')
    return asDomElement(document.querySelector(`[data-testid="${escaped}"]`))
}

const queryAllTestIdNodes = (): DomLikeElement[] => {
    const document = getDocument()
    if (!document || typeof document.querySelectorAll !== 'function') {
        return []
    }
    return Array.from(document.querySelectorAll('[data-testid]')).flatMap(value => {
        const element = asDomElement(value)
        return element ? [element] : []
    })
}

const dispatchDomEvent = (element: DomLikeElement, eventName: 'Event' | 'MouseEvent' | 'KeyboardEvent', type: string, init?: UnknownRecord) => {
    const EventCtor = browserGlobals[eventName]
    if (typeof EventCtor !== 'function' || typeof element.dispatchEvent !== 'function') {
        return false
    }
    element.dispatchEvent(new EventCtor(type, init))
    return true
}

const writeElementValue = (element: DomLikeElement, nextValue: string): void => {
    if (!(isInputElement(element) || isTextAreaElement(element))) {
        return
    }
    const prototype = Object.getPrototypeOf(element) as UnknownRecord | null
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : undefined
    if (descriptor?.set) {
        descriptor.set.call(element, nextValue)
    } else {
        element.value = nextValue
    }
    dispatchDomEvent(element, 'Event', 'input', {bubbles: true})
    dispatchDomEvent(element, 'Event', 'change', {bubbles: true})
}

const clickElement = (element: DomLikeElement): void => {
    if (typeof element.click === 'function') {
        element.click()
        return
    }
    dispatchDomEvent(element, 'MouseEvent', 'click', {bubbles: true, cancelable: true})
}

const submitElement = (element: DomLikeElement): void => {
    if (isInputElement(element) || isTextAreaElement(element)) {
        dispatchDomEvent(element, 'KeyboardEvent', 'keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
        })
        dispatchDomEvent(element, 'KeyboardEvent', 'keyup', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
        })
        return
    }
    if (isButtonElement(element)) {
        clickElement(element)
    }
}

const toJsonRpcResult = (
    id: string | number | null | undefined,
    result: unknown,
): string => JSON.stringify({
    jsonrpc: '2.0',
    id: id ?? null,
    result,
})

const toJsonRpcError = (
    id: string | number | null | undefined,
    code: number,
    message: string,
    data?: unknown,
): string => JSON.stringify({
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
        code,
        message,
        ...(data === undefined ? {} : {data}),
    },
})

const normalizeRequest = (messageJson: string): BrowserJsonRpcRequest => {
    const request = JSON.parse(messageJson) as BrowserJsonRpcRequest
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
        throw new Error('Invalid JSON-RPC request')
    }
    return request
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const createBrowserAutomationHost = (
    options: CreateBrowserAutomationHostOptions = {},
): BrowserAutomationHost => {
    const buildProfile = options.buildProfile ?? 'test'
    const target = options.target ?? 'primary'
    const runtimeId = options.runtimeId ?? `browser-${target}`
    const quietWindowMs = options.quietWindowMs ?? 120
    const automationRuntime = createAutomationRuntime({
        buildProfile,
        scriptExecutionAvailable: options.scriptExecutionAvailable ?? true,
    })
    const unregisterTarget = automationRuntime.registerTarget({
        target,
        runtimeId,
    })
    const trace = createAutomationTrace()
    const globalScope = globalThis as BrowserGlobalScope
    let started = false
    let mutationObserver: DomLikeMutationObserver | undefined
    let lastActivityAt = Date.now()
    let inFlightScriptCount = 0

    const markActivity = () => {
        lastActivityAt = Date.now()
    }

    const installMutationObserver = () => {
        const document = getDocument()
        if (
            !document
            || mutationObserver
            || !document.body
            || typeof browserGlobals.MutationObserver !== 'function'
        ) {
            return
        }
        const ObserverCtor = browserGlobals.MutationObserver
        mutationObserver = new ObserverCtor(() => {
            markActivity()
        }) as DomLikeMutationObserver
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
        })
    }

    const uninstallMutationObserver = () => {
        mutationObserver?.disconnect()
        mutationObserver = undefined
    }

    const findNodeSnapshot = (nodeId: string): BrowserAutomationNodeSnapshot | null => {
        const element = queryByTestId(nodeId)
        if (!element) {
            return null
        }
        return toNodeSnapshot({
            target,
            runtimeId,
            element,
            nodeId,
        })
    }

    const queryNodes = (params: Record<string, unknown>): readonly BrowserAutomationNodeSnapshot[] => {
        const testID = typeof params.testID === 'string' ? params.testID : undefined
        const semanticId = typeof params.semanticId === 'string' ? params.semanticId : undefined
        const role = typeof params.role === 'string' ? params.role : undefined
        const text = typeof params.text === 'string' ? params.text : undefined
        const candidates = testID
            ? [queryByTestId(testID)].filter((value): value is DomLikeElement => value != null)
            : queryAllTestIdNodes()
        return candidates
            .map(element => toNodeSnapshot({
                target,
                runtimeId,
                element,
                nodeId: getAttribute(element, 'data-testid') ?? '',
            }))
            .filter(node => {
                if (semanticId && node.semanticId !== semanticId) {
                    return false
                }
                if (role && node.role !== role) {
                    return false
                }
                if (text && node.text !== text) {
                    return false
                }
                return true
            })
    }

    const executeBrowserScript = async (
        source: string,
        params?: Record<string, unknown>,
        globals?: Record<string, unknown>,
    ): Promise<unknown> => {
        const script = new Function(
            'params',
            'globals',
            `
            "use strict";
            const automation = globalThis.${AUTOMATION_HOST_GLOBAL_KEY};
            return (async () => {
                ${source}
            })();
        `,
        ) as (
            params: Record<string, unknown> | undefined,
            globals: Record<string, unknown> | undefined,
        ) => Promise<unknown>
        return await script(params, globals)
    }

    const dispatchMessage = async (messageJson: string): Promise<string> => {
        const sessionHello = automationRuntime.hello()
        let request: BrowserJsonRpcRequest
        try {
            request = normalizeRequest(messageJson)
        } catch (error) {
            return toJsonRpcError(
                null,
                INTERNAL_ERROR_CODE,
                error instanceof Error ? error.message : String(error),
            )
        }
        const params = request.params ?? {}

        try {
            switch (request.method) {
                case 'session.hello':
                    return toJsonRpcResult(request.id, sessionHello)
                case 'runtime.getInfo':
                    return toJsonRpcResult(request.id, {
                        protocolVersion: sessionHello.protocolVersion,
                        buildProfile: sessionHello.buildProfile,
                        productMode: sessionHello.productMode,
                        availableTargets: sessionHello.availableTargets,
                        capabilities: sessionHello.capabilities,
                        runtimeId,
                        target,
                    })
                case 'runtime.getState':
                    return toJsonRpcResult(request.id, options.getRuntimeState?.() ?? null)
                case 'runtime.selectState': {
                    let value: unknown = options.getRuntimeState?.() ?? null
                    for (const segment of Array.isArray(params.path) ? params.path : []) {
                        value = value != null && typeof value === 'object'
                            ? (value as Record<string, unknown>)[String(segment)]
                            : undefined
                    }
                    return toJsonRpcResult(request.id, value ?? null)
                }
                case 'ui.getTree':
                    return toJsonRpcResult(request.id, queryNodes({}))
                case 'ui.queryNodes':
                    return toJsonRpcResult(request.id, queryNodes(params))
                case 'ui.getNode':
                    return toJsonRpcResult(request.id, findNodeSnapshot(String(params.nodeId ?? '')))
                case 'ui.performAction':
                case 'ui.revealNode':
                case 'ui.scroll':
                case 'ui.setValue':
                case 'ui.clearValue':
                case 'ui.submit': {
                    const nodeId = String(params.nodeId ?? '')
                    const element = queryByTestId(nodeId)
                    if (!element) {
                        throw new Error(`NODE_NOT_FOUND:${nodeId}`)
                    }
                    const action = request.method === 'ui.setValue'
                        ? 'changeText'
                        : request.method === 'ui.clearValue'
                            ? 'clear'
                            : request.method === 'ui.submit'
                                ? 'submit'
                                : request.method === 'ui.revealNode' || request.method === 'ui.scroll'
                                    ? 'scroll'
                                    : String(params.action ?? 'press')
                    if (action === 'changeText') {
                        writeElementValue(element, String(params.value ?? ''))
                    } else if (action === 'clear') {
                        writeElementValue(element, '')
                    } else if (action === 'submit') {
                        submitElement(element)
                    } else {
                        clickElement(element)
                    }
                    markActivity()
                    const result = findNodeSnapshot(nodeId)
                    trace.record({
                        step: request.method,
                        status: 'ok',
                        input: params,
                        output: result,
                    })
                    return toJsonRpcResult(request.id, {
                        ok: true,
                        nodeId,
                    })
                }
                case 'wait.forNode': {
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const startedAt = Date.now()
                    while (Date.now() - startedAt < timeoutMs) {
                        const nodes = queryNodes(params)
                        if (nodes[0]) {
                            return toJsonRpcResult(request.id, nodes[0])
                        }
                        await sleep(25)
                    }
                    return toJsonRpcError(request.id, WAIT_TIMEOUT_CODE, 'WAIT_FOR_NODE_TIMEOUT')
                }
                case 'wait.forIdle': {
                    const timeoutMs = Number(params.timeoutMs ?? 3_000)
                    const startedAt = Date.now()
                    let blocker = 'quiet-window'
                    while (Date.now() - startedAt < timeoutMs) {
                        if (inFlightScriptCount > 0) {
                            blocker = `in-flight-scripts:${inFlightScriptCount}`
                        } else if (Date.now() - lastActivityAt < quietWindowMs) {
                            blocker = 'quiet-window'
                        } else {
                            return toJsonRpcResult(request.id, {ok: true})
                        }
                        await sleep(25)
                    }
                    return toJsonRpcResult(request.id, {ok: false, blocker})
                }
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
                case 'scripts.execute': {
                    if (sessionHello.productMode || !sessionHello.scriptExecutionAvailable) {
                        return toJsonRpcError(
                            request.id,
                            METHOD_NOT_AVAILABLE_CODE,
                            'scripts.execute is not available',
                        )
                    }
                    inFlightScriptCount += 1
                    markActivity()
                    try {
                        const result = await executeBrowserScript(
                            String(params.source ?? ''),
                            typeof params.params === 'object' && params.params != null
                                ? params.params as Record<string, unknown>
                                : undefined,
                            typeof params.globals === 'object' && params.globals != null
                                ? params.globals as Record<string, unknown>
                                : undefined,
                        )
                        trace.record({
                            step: 'scripts.execute',
                            status: 'ok',
                            input: params,
                            output: result,
                        })
                        return toJsonRpcResult(request.id, result ?? null)
                    } finally {
                        inFlightScriptCount -= 1
                        markActivity()
                    }
                }
                default:
                    return toJsonRpcError(
                        request.id,
                        METHOD_NOT_FOUND_CODE,
                        `Unknown automation method: ${request.method}`,
                    )
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            trace.record({
                step: request.method,
                status: 'failed',
                input: params,
                error: message,
            })
            return toJsonRpcError(request.id, INTERNAL_ERROR_CODE, message)
        }
    }

    const hostApi: BrowserAutomationHost = {
        get started() {
            return started
        },
        runtimeId,
        start() {
            if (started) {
                return
            }
            started = true
            installMutationObserver()
            globalScope[AUTOMATION_HOST_GLOBAL_KEY] = hostApi
            markActivity()
        },
        stop() {
            if (!started) {
                return
            }
            started = false
            uninstallMutationObserver()
            unregisterTarget()
            if (globalScope[AUTOMATION_HOST_GLOBAL_KEY] === hostApi) {
                delete globalScope[AUTOMATION_HOST_GLOBAL_KEY]
            }
        },
        dispatchMessage,
    }

    if (options.autoStart) {
        hostApi.start()
    }

    return hostApi
}

export {AUTOMATION_HOST_GLOBAL_KEY}
