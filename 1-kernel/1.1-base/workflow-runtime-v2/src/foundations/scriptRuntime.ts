import {createAppError} from '@next/kernel-base-contracts'
import type {PlatformPorts} from '@next/kernel-base-platform-ports'
import {workflowRuntimeV2ErrorDefinitions} from '../supports'
import type {
    WorkflowContextSnapshot,
    WorkflowExpression,
    WorkflowInputMapping,
    WorkflowOutputMapping,
} from '../types'

const FUNCTION_CACHE_LIMIT = 200
const functionCache = new Map<string, Function>()

const rememberCachedFunction = (cacheKey: string, fn: Function) => {
    if (functionCache.has(cacheKey)) {
        functionCache.delete(cacheKey)
    }
    functionCache.set(cacheKey, fn)
    if (functionCache.size <= FUNCTION_CACHE_LIMIT) {
        return
    }
    const oldestKey = functionCache.keys().next().value
    if (oldestKey) {
        functionCache.delete(oldestKey)
    }
}

/**
 * 设计意图：
 * workflow script 优先交给 platformPorts.scriptExecutor，让 Android/Electron/Node 可以用各自安全边界执行动态 JS。
 * 本地 new Function 只是无适配器时的兜底和测试能力，不把脚本沙箱策略绑死在 kernel 包内。
 */
const getContextGlobals = (
    context: WorkflowContextSnapshot,
): Record<string, unknown> => {
    return {
        input: context.input,
        variables: context.variables,
        stepOutputs: context.stepOutputs,
        loopIndex: context.loopIndex,
        ...context.variables,
        ...context.stepOutputs,
    }
}

const isWorkflowExpression = (value: unknown): value is WorkflowExpression => {
    if (typeof value !== 'object' || value == null || !('type' in value)) {
        return false
    }

    const candidate = value as {
        type?: unknown
        path?: unknown
        language?: unknown
        source?: unknown
    }

    if (candidate.type === 'path') {
        return typeof candidate.path === 'string'
    }

    if (candidate.type === 'script') {
        return candidate.language === 'javascript' && typeof candidate.source === 'string'
    }

    return false
}

const executeLocalScript = async <T = unknown>(input: {
    source: string
    params?: Record<string, unknown>
    globals?: Record<string, unknown>
    timeoutMs?: number
}): Promise<T> => {
    const {
        source,
        params = {},
        globals = {},
        timeoutMs = 5_000,
    } = input

    const globalKeys = Object.keys(globals)
    const argumentNames = ['params', ...globalKeys]
    const argumentValues = [params, ...globalKeys.map(key => globals[key])]
    const cacheKey = JSON.stringify({
        source,
        argumentNames,
    })

    const runner = functionCache.get(cacheKey) ?? (() => {
        // eslint-disable-next-line no-new-func
        const created = new Function(...argumentNames, source)
        rememberCachedFunction(cacheKey, created)
        return created
    })()

    return await new Promise<T>((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
            if (settled) {
                return
            }
            settled = true
            reject(createAppError(workflowRuntimeV2ErrorDefinitions.workflowScriptFailed, {
                details: {
                    reason: 'timeout',
                    timeoutMs,
                    source: source.slice(0, 120),
                },
            }))
        }, timeoutMs)

        Promise.resolve()
            .then(() => runner(...argumentValues) as T)
            .then(result => {
                if (settled) {
                    return
                }
                settled = true
                clearTimeout(timer)
                resolve(result)
            })
            .catch(error => {
                if (settled) {
                    return
                }
                settled = true
                clearTimeout(timer)
                reject(createAppError(workflowRuntimeV2ErrorDefinitions.workflowScriptFailed, {
                    details: {
                        reason: 'execution-failed',
                        source: source.slice(0, 120),
                    },
                    cause: error,
                }))
            })
    })
}

const executeScript = async <T = unknown>(input: {
    platformPorts: PlatformPorts
    source: string
    params?: Record<string, unknown>
    globals?: Record<string, unknown>
    timeoutMs?: number
}): Promise<T> => {
    const executor = input.platformPorts.scriptExecutor
    if (executor) {
        try {
            return await executor.execute<T>({
                source: input.source,
                params: input.params,
                globals: input.globals,
                timeoutMs: input.timeoutMs,
            })
        } catch (error) {
            throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowScriptFailed, {
                details: {
                    reason: 'port-failed',
                    source: input.source.slice(0, 120),
                },
                cause: error,
            })
        }
    }

    return executeLocalScript<T>({
        source: input.source,
        params: input.params,
        globals: input.globals,
        timeoutMs: input.timeoutMs,
    })
}

export const evaluateWorkflowExpression = async <T = unknown>(input: {
    platformPorts: PlatformPorts
    expression: WorkflowExpression | unknown
    params?: Record<string, unknown>
    context: WorkflowContextSnapshot
    timeoutMs?: number
}): Promise<T> => {
    const expression = input.expression
    if (!isWorkflowExpression(expression)) {
        return expression as T
    }

    if (expression.type === 'path') {
        const segments = expression.path.split('.').filter(Boolean)
        let current: unknown = {
            params: input.params ?? {},
            input: input.context.input,
            variables: input.context.variables,
            stepOutputs: input.context.stepOutputs,
            loopIndex: input.context.loopIndex,
            context: input.context,
            ...input.context.variables,
            ...input.context.stepOutputs,
        }

        for (const segment of segments) {
            if (typeof current !== 'object' || current == null || !(segment in current)) {
                return undefined as T
            }
            current = (current as Record<string, unknown>)[segment]
        }
        return current as T
    }

    return await executeScript<T>({
        platformPorts: input.platformPorts,
        source: expression.source,
        params: input.params,
        globals: getContextGlobals(input.context),
        timeoutMs: input.timeoutMs,
    })
}

export const resolveWorkflowInput = async (input: {
    platformPorts: PlatformPorts
    mapping: WorkflowInputMapping | undefined
    params?: Record<string, unknown>
    context: WorkflowContextSnapshot
    timeoutMs?: number
}): Promise<unknown> => {
    const mapping = input.mapping
    if (!mapping) {
        return input.params ?? {}
    }

    if (mapping.value !== undefined) {
        return await evaluateWorkflowExpression({
            platformPorts: input.platformPorts,
            expression: mapping.value,
            params: input.params,
            context: input.context,
            timeoutMs: input.timeoutMs,
        })
    }

    if (mapping.from) {
        return await evaluateWorkflowExpression({
            platformPorts: input.platformPorts,
            expression: {type: 'path', path: mapping.from},
            params: input.params,
            context: input.context,
            timeoutMs: input.timeoutMs,
        })
    }

    if (mapping.object) {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(mapping.object)) {
            result[key] = await evaluateWorkflowExpression({
                platformPorts: input.platformPorts,
                expression: value,
                params: input.params,
                context: input.context,
                timeoutMs: input.timeoutMs,
            })
        }
        return result
    }

    return input.params ?? {}
}

export const applyWorkflowOutput = async (input: {
    platformPorts: PlatformPorts
    mapping: WorkflowOutputMapping | undefined
    rawOutput: unknown
    context: WorkflowContextSnapshot
    timeoutMs?: number
}): Promise<{
    output: unknown
    variablesPatch: Record<string, unknown>
}> => {
    const mapping = input.mapping
    if (!mapping) {
        return {
            output: input.rawOutput,
            variablesPatch: {},
        }
    }

    const params = typeof input.rawOutput === 'object' && input.rawOutput != null
        ? input.rawOutput as Record<string, unknown>
        : {value: input.rawOutput}
    const variablesPatch: Record<string, unknown> = {}

    if (mapping.variables) {
        for (const [key, value] of Object.entries(mapping.variables)) {
            variablesPatch[key] = await evaluateWorkflowExpression({
                platformPorts: input.platformPorts,
                expression: value,
                params,
                context: input.context,
                timeoutMs: input.timeoutMs,
            })
        }
    }

    const output = mapping.result
        ? await evaluateWorkflowExpression({
            platformPorts: input.platformPorts,
            expression: mapping.result,
            params,
            context: input.context,
            timeoutMs: input.timeoutMs,
        })
        : input.rawOutput

    return {
        output,
        variablesPatch,
    }
}

export const evaluateWorkflowCondition = async (input: {
    platformPorts: PlatformPorts
    expression: WorkflowExpression | undefined
    params?: Record<string, unknown>
    context: WorkflowContextSnapshot
    timeoutMs?: number
}): Promise<boolean> => {
    if (!input.expression) {
        return true
    }

    const result = await evaluateWorkflowExpression<boolean>({
        platformPorts: input.platformPorts,
        expression: input.expression,
        params: input.params,
        context: input.context,
        timeoutMs: input.timeoutMs,
    })
    return Boolean(result)
}
