import {describe, expect, it, vi} from 'vitest'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
    createCommandId,
    createModuleParameterFactory,
    createRequestId,
} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import {
    createCommand,
    createKernelRuntimeApp,
    createKernelRuntimeV2,
    defineCommand,
    onCommand,
    runtimeShellV2CommandDefinitions,
    runtimeShellV2StateActions,
    type ActorExecutionResult,
    type ActorDefinition,
    type DispatchedCommand,
    type KernelRuntimeModuleV2,
} from '../../src'
import {createRequestLedger} from '../../src/foundations/requestLedger'

const testModuleName = 'kernel.base.runtime-shell-v2.test'

const commandA = defineCommand<{value: number}>({
    moduleName: testModuleName,
    commandName: 'command-a',
})
const commandB = defineCommand<{value: number}>({
    moduleName: testModuleName,
    commandName: 'command-b',
})
const noActorCommand = defineCommand<void>({
    moduleName: testModuleName,
    commandName: 'no-actor',
})
const allowedNoActorCommand = defineCommand<void>({
    moduleName: testModuleName,
    commandName: 'allowed-no-actor',
    allowNoActor: true,
})
const reentryCommand = defineCommand<{depth: number}>({
    moduleName: testModuleName,
    commandName: 'reentry',
})
const allowedReentryCommand = defineCommand<{depth: number}>({
    moduleName: testModuleName,
    commandName: 'allowed-reentry',
    allowReentry: true,
})
const concurrentCommand = defineCommand<{value: number}>({
    moduleName: testModuleName,
    commandName: 'concurrent-command',
})
const timeoutCommand = defineCommand<void>({
    moduleName: testModuleName,
    commandName: 'timeout',
    timeoutMs: 5,
})
const peerCommand = defineCommand<void>({
    moduleName: testModuleName,
    commandName: 'peer-command',
    defaultTarget: 'peer',
})

const stateKey = `${testModuleName}.state`
const defineParameter = createModuleParameterFactory(testModuleName)
const positiveTimeoutParameter = defineParameter.number('positive-timeout-ms', {
    name: 'Positive Timeout',
    defaultValue: 3000,
    validate(value) {
        return Number.isFinite(value) && value > 0
    },
})
const featureEnabledParameter = defineParameter.boolean('feature-enabled', {
    name: 'Feature Enabled',
    defaultValue: true,
})

const slice = createSlice({
    name: stateKey,
    initialState: {value: 0},
    reducers: {
        setValue(state, action: PayloadAction<number>) {
            state.value = action.payload
        },
    },
})

const stateSlice: StateRuntimeSliceDescriptor<{value: number}> = {
    name: stateKey,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}

const createModule = (events: string[], beforeActorBody?: () => void): KernelRuntimeModuleV2 => {
    const actors: ActorDefinition[] = [
        {
            moduleName: testModuleName,
            actorName: 'ActorOne',
            handlers: [
                {
                    commandName: commandA.commandName,
                    async handle(context) {
                        beforeActorBody?.()
                        events.push('actor-one:a')
                        context.dispatchAction(slice.actions.setValue(context.command.payload.value))
                        const child = await context.dispatchCommand(createCommand(commandB, {
                            value: context.command.payload.value + 1,
                        }))
                        return {actor: 'one', childStatus: child.status}
                    },
                },
                {
                    commandName: commandB.commandName,
                    handle(context) {
                        events.push('actor-one:b')
                        return {value: context.command.payload.value}
                    },
                },
                {
                    commandName: reentryCommand.commandName,
                    async handle(context) {
                        events.push(`reentry:${context.command.payload.depth}`)
                        if (context.command.payload.depth < 1) {
                            await context.dispatchCommand(createCommand(reentryCommand, {depth: context.command.payload.depth + 1}))
                        }
                    },
                },
                {
                    commandName: allowedReentryCommand.commandName,
                    async handle(context) {
                        events.push(`allowed-reentry:${context.command.payload.depth}`)
                        if (context.command.payload.depth < 1) {
                            await context.dispatchCommand(createCommand(allowedReentryCommand, {depth: context.command.payload.depth + 1}))
                        }
                    },
                },
                {
                    commandName: concurrentCommand.commandName,
                    async handle(context) {
                        events.push(`concurrent:start:${context.command.payload.value}`)
                        await new Promise(resolve => setTimeout(resolve, 20))
                        events.push(`concurrent:end:${context.command.payload.value}`)
                        return {value: context.command.payload.value}
                    },
                },
            ],
        },
        {
            moduleName: testModuleName,
            actorName: 'ActorTwo',
            handlers: [
                {
                    commandName: commandA.commandName,
                    handle(context) {
                        events.push('actor-two:a')
                        return {actor: 'two', value: context.command.payload.value}
                    },
                },
                {
                    commandName: timeoutCommand.commandName,
                    async handle() {
                        await new Promise(resolve => setTimeout(resolve, 50))
                    },
                },
            ],
        },
    ]

    return {
        moduleName: testModuleName,
        packageVersion: '0.0.1',
        stateSlices: [stateSlice],
        commandDefinitions: [
            commandA,
            commandB,
            noActorCommand,
            allowedNoActorCommand,
            reentryCommand,
            allowedReentryCommand,
            concurrentCommand,
            timeoutCommand,
            peerCommand,
        ],
        actorDefinitions: actors,
    }
}

describe('runtime-shell-v2', () => {
    it('broadcasts one command to multiple actors and aggregates results', async () => {
        const events: string[] = []
        const runtime = createKernelRuntimeV2({modules: [createModule(events)]})

        await runtime.start()
        const result = await runtime.dispatchCommand(createCommand(commandA, {value: 7}))

        expect(result.status).toBe('COMPLETED')
        expect(result.actorResults.map(item => item.actorKey)).toEqual([
            `${testModuleName}.ActorOne`,
            `${testModuleName}.ActorTwo`,
        ])
        expect(events).toEqual(['actor-one:a', 'actor-one:b', 'actor-two:a'])
        expect(runtime.queryRequest(result.requestId)?.commands.map(item => item.commandName)).toEqual([
            commandA.commandName,
            commandB.commandName,
        ])
        expect((runtime.getState()[stateKey as keyof ReturnType<typeof runtime.getState>] as {value: number}).value).toBe(7)
    })

    it('exposes runtime environment mode for upper layers', async () => {
        const runtime = createKernelRuntimeV2({
            modules: [createModule([])],
            platformPorts: {
                environmentMode: 'PROD',
            },
        })

        expect(runtime.environmentMode).toBe('PROD')
    })

    it('fails no-actor commands unless allowNoActor is enabled', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const failed = await runtime.dispatchCommand(createCommand(noActorCommand, undefined))
        const completed = await runtime.dispatchCommand(createCommand(allowedNoActorCommand, undefined))

        expect(failed.status).toBe('FAILED')
        expect(completed.status).toBe('COMPLETED')
        expect(completed.actorResults).toEqual([])
    })

    it('guards same command and actor re-entry by default', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(reentryCommand, {depth: 0}))

        expect(result.status).toBe('COMPLETED')
        expect(runtime.queryRequest(result.requestId)?.commands[1]?.status).toBe('FAILED')
    })

    it('allows same command and actor re-entry when allowReentry is true', async () => {
        const events: string[] = []
        const runtime = createKernelRuntimeV2({modules: [createModule(events)]})
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(allowedReentryCommand, {depth: 0}))

        expect(result.status).toBe('COMPLETED')
        expect(events).toEqual(['allowed-reentry:0', 'allowed-reentry:1'])
    })

    it('allows same command and actor to run concurrently across different requests', async () => {
        const events: string[] = []
        const runtime = createKernelRuntimeV2({modules: [createModule(events)]})
        await runtime.start()

        const [first, second] = await Promise.all([
            runtime.dispatchCommand(createCommand(concurrentCommand, {value: 1})),
            runtime.dispatchCommand(createCommand(concurrentCommand, {value: 2})),
        ])

        expect(first.status).toBe('COMPLETED')
        expect(second.status).toBe('COMPLETED')
        expect(first.requestId).not.toBe(second.requestId)
        expect(first.actorResults[0]).toMatchObject({
            actorKey: `${testModuleName}.ActorOne`,
            status: 'COMPLETED',
        })
        expect(second.actorResults[0]).toMatchObject({
            actorKey: `${testModuleName}.ActorOne`,
            status: 'COMPLETED',
        })
        expect(events).toEqual([
            'concurrent:start:1',
            'concurrent:start:2',
            'concurrent:end:1',
            'concurrent:end:2',
        ])
    })

    it('returns TIMEOUT when actor exceeds timeout', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(timeoutCommand, undefined))

        expect(result.status).toBe('TIMEOUT')
        expect(result.actorResults[0]?.status).toBe('TIMEOUT')
    })

    it('clears actor timeout timer after command completes before deadline', async () => {
        vi.useFakeTimers()
        try {
            const runtime = createKernelRuntimeV2({modules: [createModule([])]})
            await runtime.start()

            const baselineTimerCount = vi.getTimerCount()
            const dispatchPromise = runtime.dispatchCommand(createCommand(commandA, {value: 1}))

            await vi.runAllTimersAsync()
            const result = await dispatchPromise

            expect(result.status).toBe('COMPLETED')
            expect(vi.getTimerCount()).toBe(baselineTimerCount)
        } finally {
            vi.useRealTimers()
        }
    })

    it('makes request RUNNING before actor body executes and notifies subscribers', async () => {
        const requestId = createRequestId()
        const observedStatuses: string[] = []
        let actorSawRunning = false
        const runtime = createKernelRuntimeV2({
            modules: [
                createModule([], () => {
                    actorSawRunning = runtime.queryRequest(requestId)?.status === 'RUNNING'
                }),
            ],
        })
        await runtime.start()

        runtime.subscribeRequest(requestId, request => {
            observedStatuses.push(request.status)
        })
        await runtime.dispatchCommand(createCommand(commandA, {value: 3}), {requestId})

        expect(actorSawRunning).toBe(true)
        expect(observedStatuses).toContain('RUNNING')
        expect(observedStatuses.at(-1)).toBe('COMPLETED')
    })

    it('fails peer dispatch when peer gateway is missing', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(peerCommand, undefined))

        expect(result.status).toBe('FAILED')
        expect(result.actorResults[0]?.actorKey).toBe('runtime-shell-v2.peer-dispatch')
    })

    it('uses peer gateway when available', async () => {
        const localRequestId = createRequestId()
        const peerDispatch = vi.fn(async () => ({
            requestId: localRequestId,
            commandId: 'cmd_peer' as any,
            commandName: peerCommand.commandName,
            target: 'peer' as const,
            status: 'COMPLETED' as const,
            startedAt: Date.now() as any,
            completedAt: Date.now() as any,
            actorResults: [],
        }))
        const runtime = createKernelRuntimeV2({
            modules: [createModule([])],
            peerDispatchGateway: {dispatchCommand: peerDispatch},
        })
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(peerCommand, undefined), {
            requestId: localRequestId,
        })

        expect(result.status).toBe('COMPLETED')
        expect(peerDispatch).toHaveBeenCalledTimes(1)
        expect(runtime.queryRequest(localRequestId)).toMatchObject({
            status: 'COMPLETED',
        })
        expect(runtime.queryRequest(localRequestId)?.commands[0]).toMatchObject({
            target: 'peer',
            status: 'COMPLETED',
            actorResults: [
                expect.objectContaining({
                    actorKey: 'runtime-shell-v2.peer-dispatch',
                    status: 'COMPLETED',
                }),
            ],
        })
    })

    it('broadcasts initialize after module install before start resolves', async () => {
        const events: string[] = []
        const initializeActors: ActorDefinition[] = [
            {
                moduleName: testModuleName,
                actorName: 'InitializeActor',
                handlers: [
                    onCommand(runtimeShellV2CommandDefinitions.initialize, context => {
                        events.push(`initialize:${context.command.commandName}`)
                        return {}
                    }),
                ],
            },
        ]
        const module: KernelRuntimeModuleV2 = {
            moduleName: testModuleName,
            packageVersion: '0.0.1',
            actorDefinitions: initializeActors,
            install() {
                events.push('install')
            },
        }
        const runtime = createKernelRuntimeV2({modules: [module]})

        await runtime.start()
        events.push('start-resolved')

        expect(events).toEqual([
            'install',
            `initialize:${runtimeShellV2CommandDefinitions.initialize.commandName}`,
            'start-resolved',
        ])
    })

    it('does not broadcast initialize again when start is called multiple times', async () => {
        const events: string[] = []
        const module: KernelRuntimeModuleV2 = {
            moduleName: testModuleName,
            packageVersion: '0.0.1',
            actorDefinitions: [
                {
                    moduleName: testModuleName,
                    actorName: 'InitializeActor',
                    handlers: [
                        onCommand(runtimeShellV2CommandDefinitions.initialize, () => {
                            events.push('initialize')
                            return {}
                        }),
                    ],
                },
            ],
        }
        const runtime = createKernelRuntimeV2({modules: [module]})

        await runtime.start()
        await runtime.start()

        expect(events).toEqual(['initialize'])
    })

    it('resets application state, clears request ledger, and re-broadcasts initialize', async () => {
        const events: string[] = []
        const observedStatuses: string[] = []
        let observedPreviousState: Record<string, unknown> | undefined
        const resettableSlice = createSlice({
            name: `${testModuleName}.resettable`,
            initialState: {value: 1},
            reducers: {
                setValue(state, action: PayloadAction<number>) {
                    state.value = action.payload
                },
            },
        })
        const module: KernelRuntimeModuleV2 = {
            moduleName: testModuleName,
            packageVersion: '0.0.1',
            commandDefinitions: [commandA],
            stateSlices: [
                {
                    name: resettableSlice.name,
                    reducer: resettableSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            onApplicationReset(context, input) {
                observedPreviousState = input?.previousState as Record<string, unknown> | undefined
                events.push(`reset:${input?.reason ?? ''}`)
                context.dispatchAction(resettableSlice.actions.setValue(7))
            },
            actorDefinitions: [
                {
                    moduleName: testModuleName,
                    actorName: 'InitializeActor',
                    handlers: [
                        onCommand(runtimeShellV2CommandDefinitions.initialize, () => {
                            events.push('initialize')
                            return {}
                        }),
                    ],
                },
                {
                    moduleName: testModuleName,
                    actorName: 'CommandActor',
                    handlers: [
                        onCommand(commandA, context => ({
                            value: context.command.payload.value,
                        })),
                    ],
                },
            ],
        }
        const runtime = createKernelRuntimeV2({modules: [module]})

        await runtime.start()
        runtime.getStore().dispatch(resettableSlice.actions.setValue(42))
        const requestId = createRequestId()
        runtime.subscribeRequest(requestId, request => {
            observedStatuses.push(request.status)
        })
        await runtime.dispatchCommand(createCommand(commandA, {value: 5}), {requestId})
        expect(runtime.queryRequest(requestId)?.status).toBe('COMPLETED')

        await runtime.resetApplicationState({reason: 'test-reset'})

        expect(observedStatuses.at(0)).toBe('RUNNING')
        expect(observedStatuses.at(-1)).toBe('COMPLETED')
        expect(runtime.queryRequest(requestId)).toBeUndefined()
        expect((runtime.getState()[resettableSlice.name as keyof ReturnType<typeof runtime.getState>] as {value: number}).value)
            .toBe(7)
        expect(observedPreviousState?.[resettableSlice.name]).toEqual({value: 42})
        expect(events).toEqual(['initialize', 'reset:test-reset', 'initialize'])
    })

    it('emits a terminal request snapshot before clearing running requests', () => {
        const ledger = createRequestLedger()
        const requestId = createRequestId()
        const commandId = createCommandId()
        const observedStatuses: string[] = []
        const observedActorStatuses: string[] = []
        const command: DispatchedCommand<{value: number}> = {
            runtimeId: 'runtime-shell-v2-test' as any,
            requestId,
            commandId,
            commandName: commandA.commandName,
            payload: {value: 1},
            target: 'local',
            dispatchedAt: Date.now() as any,
        }
        const runningActor: ActorExecutionResult = {
            actorKey: `${testModuleName}.LedgerActor`,
            status: 'RUNNING',
            startedAt: Date.now() as any,
        }
        ledger.subscribeRequest(requestId, request => {
            observedStatuses.push(request.status)
            observedActorStatuses.push(request.commands[0]?.actorResults[0]?.status ?? 'MISSING')
        })
        ledger.registerCommand(command)
        ledger.markActorStarted(requestId, commandId, runningActor.actorKey)
        ledger.markActorCompleted(requestId, commandId, runningActor)
        expect(ledger.query(requestId)?.status).toBe('RUNNING')
        const statusCountBeforeClear = observedStatuses.length
        const actorStatusCountBeforeClear = observedActorStatuses.length

        ledger.clear()

        expect(observedStatuses.at(-1)).toBe('FAILED')
        expect(observedStatuses).toHaveLength(statusCountBeforeClear + 1)
        expect(observedActorStatuses.at(-1)).toBe('FAILED')
        expect(observedActorStatuses).toHaveLength(actorStatusCountBeforeClear + 1)
        expect(ledger.query(requestId)).toBeUndefined()
    })

    it('rejects start when initialize actors fail and keeps the request in the ledger', async () => {
        const observedRequests: string[] = []
        const module: KernelRuntimeModuleV2 = {
            moduleName: testModuleName,
            packageVersion: '0.0.1',
            actorDefinitions: [
                {
                    moduleName: testModuleName,
                    actorName: 'FailingInitializeActor',
                    handlers: [
                        onCommand(runtimeShellV2CommandDefinitions.initialize, () => {
                            throw new Error('initialize failed for test')
                        }),
                    ],
                },
            ],
        }
        const runtime = createKernelRuntimeV2({modules: [module]})
        runtime.subscribeRequests(request => {
            if (request.commands[0]?.commandName === runtimeShellV2CommandDefinitions.initialize.commandName) {
                observedRequests.push(request.status)
            }
        })

        await expect(runtime.start()).rejects.toThrow('runtime-shell-v2 initialize failed')

        expect(observedRequests).toContain('RUNNING')
        expect(observedRequests.at(-1)).toBe('FAILED')
    })

    it('applies mirrored remote command completion into the request ledger', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const commandId = createCommandId()
        runtime.registerMirroredCommand({
            requestId,
            commandId,
            commandName: 'kernel.base.runtime-shell-v2.test.remote-command',
            target: 'peer',
        })

        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_completed' as any,
            sessionId: 'session_remote' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer-node' as any,
            eventType: 'completed',
            result: {ok: true},
            occurredAt: Date.now() as any,
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'COMPLETED',
            commands: [
                {
                    commandId,
                    status: 'COMPLETED',
                    actorResults: [
                        expect.objectContaining({
                            actorKey: 'runtime-shell-v2.remote-event',
                            status: 'COMPLETED',
                            result: {ok: true},
                        }),
                    ],
                },
            ],
        })
    })

    it('keeps mirrored remote commands RUNNING on resultPatch and only completes on completed', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const commandId = createCommandId()
        runtime.registerMirroredCommand({
            requestId,
            commandId,
            commandName: 'kernel.base.runtime-shell-v2.test.remote-command-result-patch',
            target: 'peer',
        })

        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_result_patch' as any,
            sessionId: 'session_remote_patch' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer-node' as any,
            eventType: 'resultPatch',
            resultPatch: {progress: 50},
            occurredAt: 15 as any,
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'RUNNING',
            commands: [
                {
                    commandId,
                    status: 'RUNNING',
                    completedAt: undefined,
                    actorResults: [
                        expect.objectContaining({
                            actorKey: 'runtime-shell-v2.remote-event',
                            status: 'RUNNING',
                            startedAt: expect.any(Number),
                            result: {progress: 50},
                        }),
                    ],
                },
            ],
        })

        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_result_completed' as any,
            sessionId: 'session_remote_patch' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer-node' as any,
            eventType: 'completed',
            result: {progress: 100, ok: true},
            occurredAt: 18 as any,
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'COMPLETED',
            commands: [
                {
                    commandId,
                    status: 'COMPLETED',
                    actorResults: [
                        expect.objectContaining({
                            actorKey: 'runtime-shell-v2.remote-event',
                            status: 'COMPLETED',
                            result: {progress: 100, ok: true},
                        }),
                    ],
                },
            ],
        })
    })

    it('keeps mirrored commands RUNNING on accepted and started events, and maps remote failures into actor errors', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const commandId = createCommandId()
        runtime.registerMirroredCommand({
            requestId,
            commandId,
            commandName: 'kernel.base.runtime-shell-v2.test.remote-command-progress',
            target: 'peer',
        })
        runtime.registerMirroredCommand({
            requestId,
            commandId,
            commandName: 'kernel.base.runtime-shell-v2.test.remote-command-progress',
            target: 'peer',
        })

        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_accepted' as any,
            sessionId: 'session_remote' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer-node' as any,
            eventType: 'accepted',
            occurredAt: 10 as any,
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'RUNNING',
            commands: [
                {
                    commandId,
                    status: 'RUNNING',
                    completedAt: undefined,
                    actorResults: [
                        expect.objectContaining({
                            actorKey: 'runtime-shell-v2.remote-event',
                            status: 'RUNNING',
                            startedAt: 10,
                        }),
                    ],
                },
            ],
        })

        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_started' as any,
            sessionId: 'session_remote' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer-node' as any,
            eventType: 'started',
            occurredAt: 12 as any,
        })

        expect(runtime.queryRequest(requestId)?.commands).toHaveLength(1)
        expect(runtime.queryRequest(requestId)?.commands[0]).toMatchObject({
            status: 'RUNNING',
            actorResults: [
                expect.objectContaining({
                    actorKey: 'runtime-shell-v2.remote-event',
                    status: 'RUNNING',
                    startedAt: 12,
                }),
            ],
        })

        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_failed' as any,
            sessionId: 'session_remote' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer-node' as any,
            eventType: 'failed',
            error: {
                key: 'kernel.base.runtime-shell-v2.test.remote_failed',
                code: 'REMOTE_FAILED',
                message: 'peer failed',
                details: {
                    reason: 'remote-error',
                },
            },
            occurredAt: 20 as any,
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'FAILED',
            commands: [
                {
                    commandId,
                    status: 'FAILED',
                    actorResults: [
                        {
                            actorKey: 'runtime-shell-v2.remote-event',
                            status: 'FAILED',
                            error: {
                                key: 'kernel.base.runtime-shell-v2.test.remote_failed',
                                code: 'REMOTE_FAILED',
                                message: 'peer failed',
                                name: 'kernel.base.runtime-shell-v2.test.remote_failed',
                                category: 'SYSTEM',
                                severity: 'MEDIUM',
                                createdAt: 20,
                                details: {
                                    reason: 'remote-error',
                                },
                            },
                        },
                    ],
                },
            ],
        })
    })

    it('imports request lifecycle snapshot into the request ledger', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const rootCommandId = createCommandId()
        const childCommandId = createCommandId()
        runtime.applyRequestLifecycleSnapshot({
            requestId,
            ownerNodeId: runtime.localNodeId,
            rootCommandId,
            sessionId: 'session_snapshot' as any,
            status: 'completed',
            startedAt: Date.now() as any,
            updatedAt: Date.now() as any,
            commands: [
                {
                    commandId: rootCommandId,
                    ownerNodeId: runtime.localNodeId,
                    sourceNodeId: runtime.localNodeId,
                    targetNodeId: 'peer-node' as any,
                    commandName: 'kernel.base.runtime-shell-v2.test.snapshot-root',
                    status: 'completed',
                    result: {root: true},
                    updatedAt: Date.now() as any,
                },
                {
                    commandId: childCommandId,
                    parentCommandId: rootCommandId,
                    ownerNodeId: runtime.localNodeId,
                    sourceNodeId: 'peer-node' as any,
                    targetNodeId: runtime.localNodeId,
                    commandName: 'kernel.base.runtime-shell-v2.test.snapshot-child',
                    status: 'completed',
                    result: {child: true},
                    updatedAt: Date.now() as any,
                },
            ],
            commandResults: [],
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'COMPLETED',
            commands: [
                expect.objectContaining({
                    commandId: rootCommandId,
                    status: 'COMPLETED',
                }),
                expect.objectContaining({
                    commandId: childCommandId,
                    parentCommandId: rootCommandId,
                    status: 'COMPLETED',
                }),
            ],
        })
    })

    it('replays existing request snapshots to late subscribers', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const rootCommandId = createCommandId()
        runtime.applyRequestLifecycleSnapshot({
            requestId,
            ownerNodeId: runtime.localNodeId,
            rootCommandId,
            sessionId: 'session_snapshot_replay' as any,
            status: 'completed',
            startedAt: Date.now() as any,
            updatedAt: Date.now() as any,
            commands: [
                {
                    commandId: rootCommandId,
                    ownerNodeId: runtime.localNodeId,
                    sourceNodeId: runtime.localNodeId,
                    targetNodeId: runtime.localNodeId,
                    commandName: 'kernel.base.runtime-shell-v2.test.snapshot-replay',
                    status: 'completed',
                    updatedAt: Date.now() as any,
                },
            ],
            commandResults: [],
        })

        const replayedRequestStatuses: string[] = []
        const replayedAllStatuses: string[] = []

        runtime.subscribeRequest(requestId, request => {
            replayedRequestStatuses.push(request.status)
        })
        runtime.subscribeRequests(request => {
            if (request.requestId === requestId) {
                replayedAllStatuses.push(request.status)
            }
        })

        expect(replayedRequestStatuses).toEqual(['COMPLETED'])
        expect(replayedAllStatuses).toEqual(['COMPLETED'])
    })

    it('accepts legacy complete snapshot statuses while normalizing them to completed semantics', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const rootCommandId = createCommandId()
        runtime.applyRequestLifecycleSnapshot({
            requestId,
            ownerNodeId: runtime.localNodeId,
            rootCommandId,
            sessionId: 'session_snapshot_legacy_complete' as any,
            status: 'complete' as any,
            startedAt: Date.now() as any,
            updatedAt: Date.now() as any,
            commands: [
                {
                    commandId: rootCommandId,
                    ownerNodeId: runtime.localNodeId,
                    sourceNodeId: runtime.localNodeId,
                    targetNodeId: runtime.localNodeId,
                    commandName: 'kernel.base.runtime-shell-v2.test.snapshot-legacy-complete',
                    status: 'complete' as any,
                    updatedAt: Date.now() as any,
                },
            ],
            commandResults: [],
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'COMPLETED',
            commands: [
                expect.objectContaining({
                    commandId: rootCommandId,
                    status: 'COMPLETED',
                }),
            ],
        })
    })

    it('keeps snapshot commands RUNNING while remote snapshot is still in progress', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        const requestId = createRequestId()
        const rootCommandId = createCommandId()
        runtime.applyRequestLifecycleSnapshot({
            requestId,
            ownerNodeId: runtime.localNodeId,
            rootCommandId,
            sessionId: 'session_snapshot_running' as any,
            status: 'started',
            startedAt: Date.now() as any,
            updatedAt: Date.now() as any,
            commands: [
                {
                    commandId: rootCommandId,
                    ownerNodeId: runtime.localNodeId,
                    sourceNodeId: runtime.localNodeId,
                    targetNodeId: 'peer-node' as any,
                    commandName: 'kernel.base.runtime-shell-v2.test.snapshot-running',
                    status: 'started',
                    updatedAt: Date.now() as any,
                },
            ],
            commandResults: [],
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'RUNNING',
            commands: [
                expect.objectContaining({
                    commandId: rootCommandId,
                    status: 'RUNNING',
                    completedAt: undefined,
                }),
            ],
        })
    })

    it('starts runtime through createKernelRuntimeApp with dependency-ordered pre-setup', async () => {
        const events: string[] = []
        const baseModule: KernelRuntimeModuleV2 = {
            moduleName: 'kernel.base.runtime-shell-v2.test.base',
            packageVersion: '0.0.1',
            preSetup() {
                events.push('base:pre-setup')
            },
            install() {
                events.push('base:install')
            },
        }
        const featureModule: KernelRuntimeModuleV2 = {
            moduleName: 'kernel.base.runtime-shell-v2.test.feature',
            packageVersion: '0.0.1',
            dependencies: [{moduleName: baseModule.moduleName}],
            preSetup() {
                events.push('feature:pre-setup')
            },
            install() {
                events.push('feature:install')
            },
        }

        const app = createKernelRuntimeApp({
            runtimeName: 'runtime-shell-v2-app-test',
            modules: [featureModule, baseModule],
        })

        await app.start()

        expect(app.descriptor.runtimeName).toBe('runtime-shell-v2-app-test')
        expect(app.descriptor.moduleDescriptors.map(item => item.moduleName)).toEqual([
            baseModule.moduleName,
            featureModule.moduleName,
        ])
        expect(events).toEqual([
            'base:pre-setup',
            'feature:pre-setup',
            'base:install',
            'feature:install',
        ])
    })

    it('reuses definition-registry parameter decode and validation semantics', async () => {
        const runtime = createKernelRuntimeV2({
            modules: [{
                ...createModule([]),
                parameterDefinitions: [
                    positiveTimeoutParameter,
                    featureEnabledParameter,
                ],
            }],
        })
        await runtime.start()

        runtime.getStore().dispatch(runtimeShellV2StateActions.setParameterCatalogEntry({
            key: positiveTimeoutParameter.key,
            rawValue: '-1',
            updatedAt: 1 as any,
            source: 'remote',
        }))
        runtime.getStore().dispatch(runtimeShellV2StateActions.setParameterCatalogEntry({
            key: featureEnabledParameter.key,
            rawValue: 'false',
            updatedAt: 2 as any,
            source: 'remote',
        }))

        expect(runtime.resolveParameter({
            key: positiveTimeoutParameter.key,
            definition: positiveTimeoutParameter,
        })).toEqual({
            key: positiveTimeoutParameter.key,
            value: 3000,
            source: 'catalog-fallback',
            valid: false,
        })
        expect(runtime.resolveParameter({
            key: featureEnabledParameter.key,
            definition: featureEnabledParameter,
        })).toEqual({
            key: featureEnabledParameter.key,
            value: false,
            source: 'catalog',
            valid: true,
        })
    })

    it('keeps raw catalog compatibility when resolveParameter is called without definition', async () => {
        const runtime = createKernelRuntimeV2({modules: [createModule([])]})
        await runtime.start()

        runtime.getStore().dispatch(runtimeShellV2StateActions.setParameterCatalogEntry({
            key: 'kernel.base.runtime-shell-v2.test.raw-only',
            rawValue: {enabled: true},
            updatedAt: 1 as any,
            source: 'remote',
        }))

        expect(runtime.resolveParameter<{enabled: boolean}>({
            key: 'kernel.base.runtime-shell-v2.test.raw-only',
        })).toEqual({
            key: 'kernel.base.runtime-shell-v2.test.raw-only',
            value: {enabled: true},
            source: 'catalog',
            valid: true,
        })
    })
})
