import {setTimeout as delay} from 'node:timers/promises'
import {
    createNodeId,
    createRequestId,
} from '@impos2/kernel-base-contracts'
import {createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime} from '@impos2/kernel-base-runtime-shell'
import {describe, expect, it} from 'vitest'
import {
    createWorkflowRuntimeModule,
    selectWorkflowObservationByRequestId,
    workflowRuntimeCommandNames,
} from '../../src'
import {
    CHILD_SLICE,
    createChildCommandModule,
    createTestLogger,
} from '../helpers/workflowRuntimeTestHarness'

describe('workflow-runtime advanced', () => {
    it('supports external-subscribe step and unsubscribes after first message', async () => {
        const requestId = createRequestId()
        const unsubscribed: string[] = []

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.external-subscribe'),
                connector: {
                    async subscribe(input) {
                        setTimeout(() => {
                            input.onMessage({
                                source: 'subscription',
                                value: 'message-1',
                            })
                        }, 5)
                        return 'subscription-1'
                    },
                    async unsubscribe(subscriptionId) {
                        unsubscribed.push(subscriptionId)
                    },
                },
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.external-subscribe',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'External Subscribe Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'wait-subscription',
                                name: 'Wait Subscription',
                                type: 'external-subscribe',
                                input: {
                                    value: {
                                        channel: {
                                            type: 'EVENT_STREAM',
                                            target: 'scanner',
                                        },
                                        timeoutMs: 100,
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
                workflowKey: 'test.external-subscribe',
            },
        })

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            source: 'subscription',
            value: 'message-1',
        })
        expect(unsubscribed).toEqual(['subscription-1'])
    })

    it('supports external-on step and filters by target', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.external-on'),
                connector: {
                    on(eventType, handler) {
                        setTimeout(() => {
                            handler({
                                type: eventType,
                                target: 'other',
                                value: 'ignore',
                            })
                        }, 5)
                        setTimeout(() => {
                            handler({
                                type: eventType,
                                target: 'printer',
                                value: 'matched',
                            })
                        }, 10)
                        return () => undefined
                    },
                },
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.external-on',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'External On Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'wait-event',
                                name: 'Wait Event',
                                type: 'external-on',
                                input: {
                                    value: {
                                        eventType: 'terminal.status.changed',
                                        target: 'printer',
                                        timeoutMs: 100,
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
                workflowKey: 'test.external-on',
            },
        })

        expect(result.status).toBe('completed')
        expect(result.status === 'completed' ? result.result?.result?.output : undefined).toEqual({
            type: 'terminal.status.changed',
            target: 'printer',
            value: 'matched',
        })
    })

    it('runs compensation step but keeps workflow terminal status failed', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.compensate'),
                connector: {
                    async call(input) {
                        if (input.action === 'demo.fail') {
                            throw new Error('expected failure')
                        }

                        return {
                            compensated: true,
                            action: input.action,
                        }
                    },
                },
            }),
            modules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.compensate',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Compensate Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'root',
                                name: 'Root',
                                type: 'flow',
                                steps: [
                                    {
                                        stepKey: 'do-work',
                                        name: 'Do Work',
                                        type: 'external-call',
                                        strategy: {
                                            onError: 'compensate',
                                            compensationStepKey: 'rollback',
                                        },
                                        input: {
                                            value: {
                                                channel: {type: 'INTENT', target: 'workflow'},
                                                action: 'demo.fail',
                                            },
                                        },
                                    },
                                    {
                                        stepKey: 'rollback',
                                        name: 'Rollback',
                                        type: 'command',
                                        input: {
                                            value: {
                                                commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                                payload: {value: 'rollback-done'},
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
                workflowKey: 'test.compensate',
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)
        const childState = runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof runtime.getState>] as {
            values: string[]
        }

        expect(result.status).toBe('failed')
        expect(observation?.status).toBe('FAILED')
        expect(observation?.steps['rollback']?.status).toBe('COMPLETED')
        expect(observation?.events.some(event => event.type === 'step.compensating')).toBe(true)
        expect(childState.values).toContain('rollback-done')
    })

    it('times out workflow by run option and marks terminal observation as timed out', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.workflow-timeout'),
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.workflow-timeout',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Workflow Timeout',
                            enabled: true,
                            rootStep: {
                                stepKey: 'slow-root',
                                name: 'Slow Root',
                                type: 'custom',
                                input: {
                                    value: {
                                        delayMs: 40,
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
                workflowKey: 'test.workflow-timeout',
                options: {
                    timeoutMs: 5,
                },
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('failed')
        expect(observation?.status).toBe('TIMED_OUT')
        expect(observation?.events.some(event => event.type === 'workflow.timed-out')).toBe(true)
    })

    it('uses default step timeout parameter when step timeout is not declared', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.default-step-timeout'),
            }),
            startupSeed: {
                parameterCatalog: {
                    'kernel.base.workflow-runtime.default-step-timeout-ms': {
                        key: 'kernel.base.workflow-runtime.default-step-timeout-ms',
                        rawValue: 5,
                        updatedAt: 1 as never,
                        source: 'remote',
                    },
                },
            },
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.default-step-timeout',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Default Step Timeout',
                            enabled: true,
                            rootStep: {
                                stepKey: 'slow-step',
                                name: 'Slow Step',
                                type: 'custom',
                                input: {
                                    value: {
                                        delayMs: 40,
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
                workflowKey: 'test.default-step-timeout',
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('failed')
        expect(observation?.status).toBe('TIMED_OUT')
        expect(observation?.steps['slow-step']?.status).toBe('TIMED_OUT')
    })

    it('uses default workflow timeout parameter when workflow timeout is not declared', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.default-workflow-timeout'),
            }),
            startupSeed: {
                parameterCatalog: {
                    'kernel.base.workflow-runtime.default-workflow-timeout-ms': {
                        key: 'kernel.base.workflow-runtime.default-workflow-timeout-ms',
                        rawValue: 5,
                        updatedAt: 1 as never,
                        source: 'remote',
                    },
                },
            },
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.default-workflow-timeout',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Default Workflow Timeout',
                            enabled: true,
                            rootStep: {
                                stepKey: 'slow-root',
                                name: 'Slow Root',
                                type: 'custom',
                                input: {
                                    value: {
                                        delayMs: 40,
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
                workflowKey: 'test.default-workflow-timeout',
            },
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('failed')
        expect(observation?.status).toBe('TIMED_OUT')
        expect(observation?.events.some(event => event.type === 'workflow.timed-out')).toBe(true)
    })

    it('ignores late results after timeout', async () => {
        const requestId = createRequestId()

        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.workflow-runtime.test.late-result'),
            }),
            modules: [
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'test.late-result',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Late Result Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'slow-step',
                                name: 'Slow Step',
                                type: 'custom',
                                timeoutMs: 5,
                                input: {
                                    value: {
                                        delayMs: 40,
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
                workflowKey: 'test.late-result',
            },
        })

        expect(result.status).toBe('failed')

        await delay(60)

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(observation?.status).toBe('TIMED_OUT')
        expect(observation?.steps['slow-step']?.status).toBe('TIMED_OUT')
        expect(observation?.steps['slow-step']?.output).toBeUndefined()
    })
})
