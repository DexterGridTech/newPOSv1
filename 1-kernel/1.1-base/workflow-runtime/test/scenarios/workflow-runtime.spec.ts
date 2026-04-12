import {setTimeout as delay} from 'node:timers/promises'
import {
    createNodeId,
    createRequestId,
} from '@impos2/kernel-base-contracts'
import {createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createKernelRuntime,
    selectRequestProjection,
} from '@impos2/kernel-base-runtime-shell'
import {describe, expect, it} from 'vitest'
import {
    createWorkflowRuntimeModule,
    selectWorkflowObservationByRequestId,
    workflowRuntimeCommandNames,
    type WorkflowObservation,
    type WorkflowRuntimeFacade,
} from '../../src'
import {
    CHILD_SLICE,
    createChildCommandModule,
    createTestLogger,
} from '../helpers/workflowRuntimeTestHarness'

describe('workflow-runtime', () => {
    it('keeps selector observation shape aligned with run$ terminal observation', async () => {
        const requestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacade | undefined

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.selector'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.selector-sync',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Selector Sync Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'local-output',
                                name: 'Local Output',
                                type: 'custom',
                                input: {
                                    value: {
                                        output: {value: 'alpha'},
                                    },
                                },
                            },
                        },
                    ],
                    onRuntimeReady(runtimeValue) {
                        workflowRuntime = runtimeValue
                    },
                }),
            ],
        })

        await runtime.start()

        const emissions: WorkflowObservation[] = []
        const terminalObservation = await new Promise<WorkflowObservation>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.selector-sync',
                requestId,
            }).subscribe({
                next(observation) {
                    emissions.push(observation)
                    if (observation.status === 'COMPLETED') {
                        subscription.unsubscribe()
                        resolve(observation)
                    }
                },
                error: reject,
            })
        })

        const fromSelector = selectWorkflowObservationByRequestId(runtime.getState(), requestId)
        const requestProjection = selectRequestProjection(runtime.getState(), requestId)

        expect(emissions.some(item => item.status === 'RUNNING')).toBe(true)
        expect(terminalObservation.status).toBe('COMPLETED')
        expect(fromSelector).toEqual(terminalObservation)
        expect(requestProjection?.status).toBeUndefined()
        expect(terminalObservation.context.stepOutputs['local-output']).toEqual({value: 'alpha'})
    })

    it('serializes workflow runs and emits waiting state for queued requests', async () => {
        const firstRequestId = createRequestId()
        const secondRequestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacade | undefined

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.queue'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.serial-queue',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Serial Queue Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'local-delay',
                                name: 'Local Delay',
                                type: 'custom',
                                input: {
                                    value: {
                                        delayMs: 30,
                                        output: {value: 'queued'},
                                    },
                                },
                            },
                        },
                    ],
                    onRuntimeReady(runtimeValue) {
                        workflowRuntime = runtimeValue
                    },
                }),
            ],
        })

        await runtime.start()

        const firstStatuses: string[] = []
        const secondStatuses: string[] = []

        const firstDone = new Promise<WorkflowObservation>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.serial-queue',
                requestId: firstRequestId,
            }).subscribe({
                next(observation) {
                    firstStatuses.push(observation.status)
                    if (observation.status === 'COMPLETED') {
                        subscription.unsubscribe()
                        resolve(observation)
                    }
                },
                error: reject,
            })
        })

        await delay(5)

        const secondDone = new Promise<WorkflowObservation>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.serial-queue',
                requestId: secondRequestId,
            }).subscribe({
                next(observation) {
                    secondStatuses.push(observation.status)
                    if (observation.status === 'COMPLETED') {
                        subscription.unsubscribe()
                        resolve(observation)
                    }
                },
                error: reject,
            })
        })

        const [firstObservation, secondObservation] = await Promise.all([firstDone, secondDone])

        expect(firstStatuses[0]).toBe('RUNNING')
        expect(secondStatuses[0]).toBe('WAITING_IN_QUEUE')
        expect(secondStatuses.includes('RUNNING')).toBe(true)
        expect(firstObservation.completedAt).toBeDefined()
        expect(secondObservation.completedAt).toBeDefined()
        expect((firstObservation.completedAt ?? 0) <= (secondObservation.completedAt ?? 0)).toBe(true)
    })

    it('runs command-step workflow through runWorkflow command and returns terminal summary', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.command-entry'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.command-entry',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Command Entry Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'append',
                                name: 'Append',
                                type: 'command',
                                input: {
                                    value: {
                                        commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                        payload: {value: 'via-command'},
                                    },
                                },
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.command-entry',
            },
        })

        const projection = selectRequestProjection(runtime.getState(), requestId)
        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)
        const childState = runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof runtime.getState>] as {
            values: string[]
        }

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.status : undefined).toBe('COMPLETED')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            appended: 'via-command',
        })
        expect(result.status === 'completed' ? result.result?.result?.stepOutputs : undefined).toEqual({
            append: {
                appended: 'via-command',
            },
        })
        expect(projection?.status).toBe('complete')
        expect(observation?.status).toBe('COMPLETED')
        expect(childState.values).toEqual(['via-command'])
    })

    it('resolves definitions by source priority host over remote over module', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.definition-priority'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            definitionId: 'module-definition' as never,
                            workflowKey: 'test.definition-priority',
                            moduleName: 'kernel.base.workflow-runtime.test.module',
                            name: 'Module Definition',
                            enabled: true,
                            updatedAt: 1,
                            rootStep: {
                                stepKey: 'module-step',
                                name: 'Module Step',
                                type: 'custom',
                                input: {
                                    value: {
                                        output: {source: 'module'},
                                    },
                                },
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        await runtime.execute({
            commandName: workflowRuntimeCommandNames.registerWorkflowDefinitions,
            requestId: createRequestId(),
            payload: {
                source: 'remote',
                definitions: [
                    {
                        definitionId: 'remote-definition',
                        workflowKey: 'test.definition-priority',
                        moduleName: 'kernel.base.workflow-runtime.test.remote',
                        name: 'Remote Definition',
                        enabled: true,
                        updatedAt: 100,
                        rootStep: {
                            stepKey: 'remote-step',
                            name: 'Remote Step',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {source: 'remote'},
                                },
                            },
                        },
                    },
                ],
            },
        })

        await runtime.execute({
            commandName: workflowRuntimeCommandNames.registerWorkflowDefinitions,
            requestId: createRequestId(),
            payload: {
                source: 'host',
                definitions: [
                    {
                        definitionId: 'host-definition',
                        workflowKey: 'test.definition-priority',
                        moduleName: 'kernel.base.workflow-runtime.test.host',
                        name: 'Host Definition',
                        enabled: true,
                        updatedAt: 2,
                        rootStep: {
                            stepKey: 'host-step',
                            name: 'Host Step',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {source: 'host'},
                                },
                            },
                        },
                    },
                ],
            },
        })

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.definition-priority',
            },
        })

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            source: 'host',
        })
    })

    it('fails observation when workflow definition is missing', async () => {
        const requestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacade | undefined

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.not-found'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    onRuntimeReady(runtimeValue) {
                        workflowRuntime = runtimeValue
                    },
                }),
            ],
        })

        await runtime.start()

        const terminalObservation = await new Promise<WorkflowObservation>((resolve, reject) => {
            workflowRuntime!.run$({
                workflowKey: 'missing.workflow',
                requestId,
            }).subscribe({
                next(observation) {
                    if (observation.status === 'FAILED') {
                        resolve(observation)
                    }
                },
                error: reject,
            })
        })

        expect(terminalObservation.status).toBe('FAILED')
        expect(terminalObservation.error?.key).toBe(
            'kernel.base.workflow-runtime.workflow_definition_not_found',
        )
    })

    it('rejects duplicate active request ids', async () => {
        const requestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacade | undefined

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.duplicate'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.duplicate',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Duplicate Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'local-delay',
                                name: 'Local Delay',
                                type: 'custom',
                                input: {
                                    value: {
                                        delayMs: 20,
                                        output: {value: 'dup'},
                                    },
                                },
                            },
                        },
                    ],
                    onRuntimeReady(runtimeValue) {
                        workflowRuntime = runtimeValue
                    },
                }),
            ],
        })

        await runtime.start()

        const subscription = workflowRuntime!.run$({
            workflowKey: 'test.duplicate',
            requestId,
        }).subscribe()

        try {
            workflowRuntime!.run$({
                workflowKey: 'test.duplicate',
                requestId,
            })
            throw new Error('expected duplicate request error')
        } catch (error) {
            expect((error as {key?: string}).key).toBe(
                'kernel.base.workflow-runtime.workflow_run_duplicate_request',
            )
        }

        subscription.unsubscribe()
    })

    it('cancels queued workflow runs', async () => {
        const firstRequestId = createRequestId()
        const secondRequestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacade | undefined

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.cancel'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.cancel-queue',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Cancel Queue Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'local-delay',
                                name: 'Local Delay',
                                type: 'custom',
                                input: {
                                    value: {
                                        delayMs: 40,
                                        output: {value: 'cancel'},
                                    },
                                },
                            },
                        },
                    ],
                    onRuntimeReady(runtimeValue) {
                        workflowRuntime = runtimeValue
                    },
                }),
            ],
        })

        await runtime.start()

        const firstDone = new Promise<void>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.cancel-queue',
                requestId: firstRequestId,
            }).subscribe({
                next(observation) {
                    if (observation.status === 'COMPLETED') {
                        subscription.unsubscribe()
                        resolve()
                    }
                },
                error: reject,
            })
        })

        await delay(5)

        const secondStatuses: string[] = []
        const secondDone = new Promise<WorkflowObservation>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.cancel-queue',
                requestId: secondRequestId,
            }).subscribe({
                next(observation) {
                    secondStatuses.push(observation.status)
                    if (observation.status === 'CANCELLED') {
                        subscription.unsubscribe()
                        resolve(observation)
                    }
                },
                error: reject,
            })
        })

        await delay(5)
        workflowRuntime!.cancel({
            requestId: secondRequestId,
            reason: 'test-cancel',
        })

        const cancelledObservation = await secondDone
        await firstDone

        expect(secondStatuses[0]).toBe('WAITING_IN_QUEUE')
        expect(cancelledObservation.status).toBe('CANCELLED')
    })

    it('supports condition, input script and output script through platform script executor fallback', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.scripts'),
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.scripts',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Script Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'root',
                                name: 'Root Flow',
                                type: 'flow',
                                steps: [
                                    {
                                        stepKey: 'compose',
                                        name: 'Compose Payload',
                                        type: 'custom',
                                        input: {
                                            value: {
                                                type: 'script',
                                                language: 'javascript',
                                                source: `
                                                    return {
                                                        output: {
                                                            amount: input.amount,
                                                            doubled: input.amount * 2
                                                        }
                                                    }
                                                `,
                                            },
                                        },
                                        output: {
                                            result: {
                                                type: 'script',
                                                language: 'javascript',
                                                source: `
                                                    return {
                                                        label: 'ok-' + params.doubled,
                                                        amount: params.amount
                                                    }
                                                `,
                                            },
                                            variables: {
                                                summary: {
                                                    type: 'script',
                                                    language: 'javascript',
                                                    source: `return 'summary-' + params.doubled`,
                                                },
                                            },
                                        },
                                    },
                                    {
                                        stepKey: 'guarded',
                                        name: 'Guarded Step',
                                        type: 'custom',
                                        condition: {
                                            type: 'script',
                                            language: 'javascript',
                                            source: `return summary === 'summary-20'`,
                                        },
                                        input: {
                                            value: {
                                                output: {passed: true},
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.scripts',
                input: {
                    amount: 10,
                },
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            label: 'ok-20',
            amount: 10,
        })
        expect(result.status === 'completed' ? result.result?.result?.variables : undefined).toEqual({
            summary: 'summary-20',
        })
        expect(result.status === 'completed' ? result.result?.result?.stepOutputs : undefined).toEqual({
            compose: {
                label: 'ok-20',
                amount: 10,
            },
            guarded: {
                passed: true,
            },
        })
        expect(observation?.steps['guarded']?.status).toBe('COMPLETED')
    })

    it('supports external-call steps through connector port', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.external-call'),
                connector: {
                    async call(input) {
                        return {
                            echoedAction: input.action,
                            echoedChannel: input.channel.target,
                        }
                    },
                },
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.external-call',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'External Call Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'remote-call',
                                name: 'Remote Call',
                                type: 'external-call',
                                input: {
                                    value: {
                                        channel: {
                                            type: 'INTENT',
                                            target: 'scanner',
                                        },
                                        action: 'demo.scan',
                                    },
                                },
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.external-call',
            },
        })

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            echoedAction: 'demo.scan',
            echoedChannel: 'scanner',
        })
    })

    it('retries failed steps when retry strategy is configured', async () => {
        const requestId = createRequestId()
        let attempt = 0

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.retry'),
                connector: {
                    async call() {
                        attempt += 1
                        if (attempt < 2) {
                            throw new Error('temporary failure')
                        }
                        return {ok: true, attempt}
                    },
                },
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.retry',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Retry Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'retryable',
                                name: 'Retryable',
                                type: 'external-call',
                                strategy: {
                                    onError: 'retry',
                                    retry: {
                                        times: 1,
                                        intervalMs: 1,
                                    },
                                },
                                input: {
                                    value: {
                                        channel: {type: 'INTENT', target: 'retry'},
                                        action: 'demo.retry',
                                    },
                                },
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.retry',
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            ok: true,
            attempt: 2,
        })
        expect(observation?.steps['retryable']?.retryCount).toBe(1)
    })

    it('skips failed steps when skip strategy is configured', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.skip'),
                connector: {
                    async call() {
                        throw new Error('skip me')
                    },
                },
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.skip',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Skip Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'root',
                                name: 'Root',
                                type: 'flow',
                                steps: [
                                    {
                                        stepKey: 'maybe-fail',
                                        name: 'Maybe Fail',
                                        type: 'external-call',
                                        strategy: {
                                            onError: 'skip',
                                        },
                                        input: {
                                            value: {
                                                channel: {type: 'INTENT', target: 'skip'},
                                                action: 'demo.skip',
                                            },
                                        },
                                    },
                                    {
                                        stepKey: 'after-skip',
                                        name: 'After Skip',
                                        type: 'custom',
                                        input: {
                                            value: {
                                                output: {continued: true},
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.skip',
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('completed')
        expect(observation?.steps['maybe-fail']?.status).toBe('SKIPPED')
        expect(observation?.steps['after-skip']?.status).toBe('COMPLETED')
    })

    it('fails timed out steps with structured workflow error', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.timeout'),
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.timeout',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Timeout Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'too-slow',
                                name: 'Too Slow',
                                type: 'custom',
                                timeoutMs: 5,
                                input: {
                                    value: {
                                        delayMs: 30,
                                        output: {late: true},
                                    },
                                },
                            },
                        },
                    ],
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId,
            payload: {
                workflowKey: 'test.timeout',
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('failed')
        expect(observation?.status).toBe('TIMED_OUT')
        expect(observation?.steps['too-slow']?.status).toBe('TIMED_OUT')
        expect(observation?.error?.key).toBe('kernel.base.workflow-runtime.workflow_step_failed')
    })
})
