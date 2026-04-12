import {describe, expect, it} from 'vitest'
import {
    createAppError,
    createCommandId,
    createRequestId,
    createSessionId,
    INTERNAL_REQUEST_ID,
    INTERNAL_SESSION_ID,
} from '@impos2/kernel-base-contracts'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createExecutionCommand,
    createExecutionRuntime,
    createInternalExecutionCommand,
    executionRuntimeErrorDefinitions,
    type ExecutionMiddleware,
} from '../../src'

const createTestLogger = () => createLoggerPort({
    environmentMode: 'DEV',
    write() {},
    scope: {
        moduleName: 'kernel.base.execution-runtime.test',
        layer: 'kernel',
    },
})

const createTestCommand = (input: {
    commandName: string
    payload?: Record<string, unknown>
}) => createExecutionCommand({
    commandId: createCommandId(),
    requestId: createRequestId(),
    sessionId: createSessionId(),
    commandName: input.commandName,
    payload: input.payload ?? {},
})

describe('execution-runtime', () => {
    it('emits started synchronously before handler body and records completed lifecycle', async () => {
        const lifecycle: string[] = []
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
            onLifecycleEvent: event => {
                lifecycle.push(event.eventType)
            },
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.echo', async context => {
            expect(lifecycle).toEqual(['started'])
            return {
                echo: context.command.payload,
            }
        })

        const command = createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.echo',
            payload: {ok: true},
        })
        const observedLifecycle: string[] = []

        const result = await runtime.execute(command, {
            onLifecycleEvent: event => {
                observedLifecycle.push(event.eventType)
            },
        })

        expect(result).toEqual({
            status: 'completed',
            result: {
                echo: {ok: true},
            },
        })
        expect(lifecycle).toEqual(['started', 'completed'])
        expect(observedLifecycle).toEqual(['started', 'completed'])
        expect(runtime.getJournal().list().map(event => event.eventType)).toEqual([
            'started',
            'completed',
        ])
        expect(runtime.getJournal().list()[0]).toMatchObject({
            commandId: command.commandId,
            requestId: command.requestId,
            commandName: command.commandName,
            internal: false,
        })
    })

    it('preserves internal command semantics and default internal request/session ids', async () => {
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.internal', async context => ({
            internal: context.command.internal === true,
            requestId: context.command.requestId,
            sessionId: context.command.sessionId,
        }))

        const result = await runtime.execute(createInternalExecutionCommand({
            commandId: createCommandId(),
            commandName: 'kernel.base.execution-runtime.test.internal',
            payload: {},
        }))

        expect(result.status).toBe('completed')
        if (result.status !== 'completed') {
            throw new Error('expected internal command to complete')
        }
        expect(result.result).toMatchObject({
            internal: true,
            requestId: INTERNAL_REQUEST_ID,
            sessionId: INTERNAL_SESSION_ID,
        })
        expect(runtime.getJournal().list().map(event => event.internal)).toEqual([true, true])
    })

    it('runs middleware around handlers in deterministic nested order', async () => {
        const order: string[] = []
        const middlewares: ExecutionMiddleware[] = [
            {
                name: 'outer',
                async handle(_context, next) {
                    order.push('outer-before')
                    const result = await next()
                    order.push('outer-after')
                    return result
                },
            },
            {
                name: 'inner',
                async handle(_context, next) {
                    order.push('inner-before')
                    const result = await next()
                    order.push('inner-after')
                    return result
                },
            },
        ]
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
            middlewares,
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.middleware', async () => {
            order.push('handler')
            return {ok: true}
        })

        const result = await runtime.execute(createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.middleware',
        }))

        expect(result.status).toBe('completed')
        expect(order).toEqual([
            'outer-before',
            'inner-before',
            'handler',
            'inner-after',
            'outer-after',
        ])
    })

    it('rejects middleware next re-entry and normalizes it into a failed execution result', async () => {
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
            middlewares: [
                {
                    name: 're-entry',
                    async handle(_context, next) {
                        await next()
                        return next()
                    },
                },
            ],
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.re-entry', async () => ({ok: true}))

        const result = await runtime.execute(createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.re-entry',
        }))

        expect(result.status).toBe('failed')
        if (result.status !== 'failed') {
            throw new Error('expected middleware re-entry to fail')
        }
        expect(result.error).toMatchObject({
            key: executionRuntimeErrorDefinitions.commandExecutionFailed.key,
            commandName: 'kernel.base.execution-runtime.test.re-entry',
        })
        expect(runtime.getJournal().list().map(event => event.eventType)).toEqual([
            'started',
            'completed',
            'failed',
        ])
    })

    it('supports child dispatch while preserving parent and child lifecycle order', async () => {
        const lifecycle: string[] = []
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
            onLifecycleEvent: event => {
                lifecycle.push(`${event.commandName}:${event.eventType}`)
            },
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.child', async context => ({
            parentCommandId: context.command.parentCommandId,
            value: 'child-result',
        }))

        runtime.registerHandler('kernel.base.execution-runtime.test.parent', async context => {
            const childCommandId = createCommandId()
            const childResult = await context.dispatchChild(createExecutionCommand({
                commandId: childCommandId,
                requestId: context.command.requestId,
                sessionId: context.command.sessionId,
                parentCommandId: context.command.commandId,
                commandName: 'kernel.base.execution-runtime.test.child',
                payload: {from: 'parent'},
            }))

            if (childResult.status !== 'completed') {
                throw new Error('child command failed')
            }

            return {
                child: childResult.result,
            }
        })

        const parentCommand = createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.parent',
        })
        const result = await runtime.execute(parentCommand)

        expect(result.status).toBe('completed')
        if (result.status !== 'completed') {
            throw new Error('expected parent command to complete')
        }
        expect(result.result).toEqual({
            child: {
                parentCommandId: parentCommand.commandId,
                value: 'child-result',
            },
        })
        expect(lifecycle).toEqual([
            'kernel.base.execution-runtime.test.parent:started',
            'kernel.base.execution-runtime.test.child:started',
            'kernel.base.execution-runtime.test.child:completed',
            'kernel.base.execution-runtime.test.parent:completed',
        ])
    })

    it('returns structured failed result when handler throws a plain error', async () => {
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.throw', async () => {
            throw new Error('plain failure')
        })

        const result = await runtime.execute(createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.throw',
        }))

        expect(result.status).toBe('failed')
        if (result.status !== 'failed') {
            throw new Error('expected failed result')
        }
        expect(result.error).toMatchObject({
            key: executionRuntimeErrorDefinitions.commandExecutionFailed.key,
            message: 'Execution failed for kernel.base.execution-runtime.test.throw',
            commandName: 'kernel.base.execution-runtime.test.throw',
        })
        expect(runtime.getJournal().list().map(event => event.eventType)).toEqual([
            'started',
            'failed',
        ])
    })

    it('preserves AppError thrown by handler without re-wrapping it', async () => {
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
        })
        const appError = createAppError(executionRuntimeErrorDefinitions.commandExecutionFailed, {
            args: {
                commandName: 'custom',
            },
            details: {
                source: 'handler',
            },
        })

        runtime.registerHandler('kernel.base.execution-runtime.test.app-error', async () => {
            throw appError
        })

        const result = await runtime.execute(createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.app-error',
        }))

        expect(result.status).toBe('failed')
        if (result.status !== 'failed') {
            throw new Error('expected failed result')
        }
        expect(result.error).toBe(appError)
    })

    it('throws structured command_not_found before emitting lifecycle when no handler is registered', async () => {
        const runtime = createExecutionRuntime({
            logger: createTestLogger(),
        })
        const command = createTestCommand({
            commandName: 'kernel.base.execution-runtime.test.missing',
        })

        await expect(runtime.execute(command)).rejects.toMatchObject({
            key: executionRuntimeErrorDefinitions.commandNotFound.key,
            commandName: command.commandName,
            commandId: command.commandId,
            requestId: command.requestId,
        })
        expect(runtime.getJournal().list()).toEqual([])
    })
})
