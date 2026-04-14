import {setTimeout as delay} from 'node:timers/promises'
import {describe, expect, it} from 'vitest'
import {createRequestId, type RequestId} from '@impos2/kernel-base-contracts'
import {createCommand, runtimeShellV2CommandDefinitions} from '@impos2/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {
    createWorkflowRuntimeModuleV2,
    selectWorkflowDefinition,
    selectWorkflowObservationByRequestId,
    workflowRuntimeV2CommandDefinitions,
    type WorkflowObservation,
    type WorkflowRuntimeFacadeV2,
} from '../../src'
import {
    CHILD_SLICE,
    CHILD_MODULE_NAME,
    createChildCommandModule,
    createTestRuntime,
} from '../helpers/workflowRuntimeV2Harness'

describe('workflow-runtime-v2', () => {
    it('keeps selector observation shape aligned with run$ terminal observation', async () => {
        const requestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacadeV2 | undefined

        const runtime = createTestRuntime([
            createChildCommandModule(),
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.selector-sync',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
        ])
        await runtime.start()

        const emissions: WorkflowObservation[] = []
        const terminal = await new Promise<WorkflowObservation>((resolve, reject) => {
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

        expect(emissions.some(item => item.status === 'RUNNING')).toBe(true)
        expect(terminal.status).toBe('COMPLETED')
        expect(fromSelector).toEqual(terminal)
        expect(terminal.context.stepOutputs['local-output']).toEqual({value: 'alpha'})
    })

    it('serializes workflow runs and emits waiting state for queued requests', async () => {
        const firstRequestId = createRequestId()
        const secondRequestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacadeV2 | undefined

        const runtime = createTestRuntime([
            createChildCommandModule(),
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.serial-queue',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
        ])
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
        expect((firstObservation.completedAt ?? 0) <= (secondObservation.completedAt ?? 0)).toBe(true)
    })

    it('retains only the latest completed observations while keeping active runs intact', async () => {
        const firstRequestId = createRequestId()
        const secondRequestId = createRequestId()
        const thirdRequestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacadeV2 | undefined

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.retention',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Retention Workflow',
                        enabled: true,
                        rootStep: {
                            stepKey: 'delay',
                            name: 'Delay',
                            type: 'custom',
                            input: {
                                value: {
                                    delayMs: 5,
                                    output: {ok: true},
                                },
                            },
                        },
                    },
                ],
                onRuntimeReady(runtimeValue) {
                    workflowRuntime = runtimeValue
                },
            }),
        ])
        await runtime.start()

        await runtime.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries, {
            entries: [
                {
                    key: 'kernel.base.workflow-runtime-v2.completed-observation-limit',
                    rawValue: 1,
                    updatedAt: 1 as any,
                    source: 'host',
                },
            ],
        }))

        const runToCompletion = async (requestId: RequestId) => {
            await new Promise<void>((resolve, reject) => {
                const subscription = workflowRuntime!.run$({
                    workflowKey: 'test.retention',
                    requestId,
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
        }

        await runToCompletion(firstRequestId)
        await runToCompletion(secondRequestId)

        expect(selectWorkflowObservationByRequestId(runtime.getState(), firstRequestId)).toBeUndefined()
        expect(selectWorkflowObservationByRequestId(runtime.getState(), secondRequestId)?.status).toBe('COMPLETED')

        const thirdStatuses: string[] = []
        const thirdDone = new Promise<void>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.retention',
                requestId: thirdRequestId,
            }).subscribe({
                next(observation) {
                    thirdStatuses.push(observation.status)
                    if (observation.status === 'COMPLETED') {
                        subscription.unsubscribe()
                        resolve()
                    }
                },
                error: reject,
            })
        })

        await delay(1)

        expect(selectWorkflowObservationByRequestId(runtime.getState(), thirdRequestId)?.status).toBeDefined()

        await thirdDone

        expect(thirdStatuses.includes('RUNNING')).toBe(true)
        expect(selectWorkflowObservationByRequestId(runtime.getState(), secondRequestId)).toBeUndefined()
        expect(selectWorkflowObservationByRequestId(runtime.getState(), thirdRequestId)?.status).toBe('COMPLETED')
    })

    it('propagates setup errors to run$ subscribers instead of leaving the stream hanging', async () => {
        let workflowRuntime: WorkflowRuntimeFacadeV2 | undefined
        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.duplicate-request',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Duplicate Request Workflow',
                        enabled: true,
                        rootStep: {
                            stepKey: 'delay',
                            name: 'Delay',
                            type: 'custom',
                            input: {
                                value: {
                                    delayMs: 50,
                                    output: {ok: true},
                                },
                            },
                        },
                    },
                ],
                onRuntimeReady(runtimeValue) {
                    workflowRuntime = runtimeValue
                },
            }),
        ])
        await runtime.start()

        const duplicatedRequestId = createRequestId()

        const firstRun = new Promise<void>((resolve, reject) => {
            const subscription = workflowRuntime!.run$({
                workflowKey: 'test.duplicate-request',
                requestId: duplicatedRequestId,
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

        const error = await new Promise<unknown>(resolve => {
            workflowRuntime!.run$({
                workflowKey: 'test.duplicate-request',
                requestId: duplicatedRequestId,
            }).subscribe({
                error: resolve,
            })
        })

        expect(error).toMatchObject({
            key: expect.any(String),
            message: expect.stringContaining('is already active'),
        })
        await firstRun
    })

    it('allows completed observation limit to be set to zero', async () => {
        const firstRequestId = createRequestId()
        const secondRequestId = createRequestId()
        let workflowRuntime: WorkflowRuntimeFacadeV2 | undefined

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.zero-completed-limit',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Zero Completed Limit Workflow',
                        enabled: true,
                        rootStep: {
                            stepKey: 'done',
                            name: 'Done',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {ok: true},
                                },
                            },
                        },
                    },
                ],
                onRuntimeReady(runtimeValue) {
                    workflowRuntime = runtimeValue
                },
            }),
        ])
        await runtime.start()

        await runtime.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries, {
            entries: [
                {
                    key: 'kernel.base.workflow-runtime-v2.completed-observation-limit',
                    rawValue: 0,
                    updatedAt: 1 as any,
                    source: 'host',
                },
            ],
        }))

        const runToCompletion = async (requestId: RequestId) => {
            await new Promise<void>((resolve, reject) => {
                const subscription = workflowRuntime!.run$({
                    workflowKey: 'test.zero-completed-limit',
                    requestId,
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
        }

        await runToCompletion(firstRequestId)
        await runToCompletion(secondRequestId)

        expect(selectWorkflowObservationByRequestId(runtime.getState(), firstRequestId)).toBeUndefined()
        expect(selectWorkflowObservationByRequestId(runtime.getState(), secondRequestId)).toBeUndefined()
    })

    it('runs command-step workflow through runWorkflow command and returns terminal summary', async () => {
        const requestId = createRequestId()

        const runtime = createTestRuntime([
            createChildCommandModule(),
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.command-entry',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Command Entry Workflow',
                        enabled: true,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: `${CHILD_MODULE_NAME}.append`,
                                    payload: {value: 'via-command'},
                                },
                            },
                        },
                    },
                ],
            }),
        ])
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.command-entry',
        }), {
            requestId,
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)
        const childState = runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof runtime.getState>] as {
            values: string[]
        }

        expect(result.status).toBe('COMPLETED')
        expect((result.actorResults[0]?.result as any)?.status).toBe('COMPLETED')
        expect((result.actorResults[0]?.result as any)?.result?.output).toEqual({
            appended: 'via-command',
        })
        expect(observation?.status).toBe('COMPLETED')
        expect(childState.values).toEqual(['via-command'])
    })

    it('resolves definitions by source priority host over remote over module over test', async () => {
        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.priority',
                        moduleName: 'module',
                        name: 'Module',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {stepKey: 'a', name: 'A', type: 'custom'},
                    },
                    {
                        workflowKey: 'test.priority',
                        moduleName: 'test',
                        name: 'Test',
                        enabled: true,
                        updatedAt: 0,
                        rootStep: {stepKey: 'a', name: 'A', type: 'custom'},
                    },
                ],
            }),
        ])
        await runtime.start()

        await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.registerWorkflowDefinitions, {
            source: 'remote',
            definitions: [{
                workflowKey: 'test.priority',
                moduleName: 'remote',
                name: 'Remote',
                enabled: true,
                updatedAt: 2,
                rootStep: {stepKey: 'a', name: 'A', type: 'custom'},
            }],
        }))

        await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.registerWorkflowDefinitions, {
            source: 'host',
            definitions: [{
                workflowKey: 'test.priority',
                moduleName: 'host',
                name: 'Host',
                enabled: true,
                updatedAt: 3,
                rootStep: {stepKey: 'a', name: 'A', type: 'custom'},
            }],
        }))

        expect(selectWorkflowDefinition(runtime.getState(), 'test.priority')[0]?.moduleName).toBe('host')
    })

    it('selects workflow definition by runtime platform and falls back to generic definition', async () => {
        const matchedRequestId = createRequestId()
        const fallbackRequestId = createRequestId()

        const matchedRuntime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                runtimePlatform: {
                    os: 'android',
                    osVersion: '14',
                    deviceModel: 'PDA-A',
                    runtimeVersion: '2.0.0',
                    capabilities: ['scanner', 'printer'],
                },
                initialDefinitions: [
                    {
                        workflowKey: 'test.platform',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Generic Definition',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'generic-output',
                            name: 'Generic Output',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {variant: 'generic'},
                                },
                            },
                        },
                    },
                    {
                        workflowKey: 'test.platform',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Android Definition',
                        enabled: true,
                        updatedAt: 2,
                        platform: {
                            os: 'android',
                            osVersion: '14',
                            deviceModel: 'PDA-A',
                            runtimeVersion: '2.0.0',
                            capabilities: ['scanner'],
                        },
                        rootStep: {
                            stepKey: 'android-output',
                            name: 'Android Output',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {variant: 'android'},
                                },
                            },
                        },
                    },
                ],
            }),
        ])
        await matchedRuntime.start()

        const matchedResult = await matchedRuntime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.platform',
        }), {
            requestId: matchedRequestId,
        })

        expect(matchedResult.status).toBe('COMPLETED')
        expect((matchedResult.actorResults[0]?.result as any)?.result?.output).toEqual({
            variant: 'android',
        })

        const fallbackRuntime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                runtimePlatform: {
                    os: 'ios',
                    osVersion: '18',
                    deviceModel: 'PAD-B',
                },
                initialDefinitions: [
                    {
                        workflowKey: 'test.platform',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Generic Definition',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'generic-output',
                            name: 'Generic Output',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {variant: 'generic'},
                                },
                            },
                        },
                    },
                    {
                        workflowKey: 'test.platform',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Android Definition',
                        enabled: true,
                        updatedAt: 2,
                        platform: {
                            os: 'android',
                            osVersion: '14',
                            capabilities: ['scanner'],
                        },
                        rootStep: {
                            stepKey: 'android-output',
                            name: 'Android Output',
                            type: 'custom',
                            input: {
                                value: {
                                    output: {variant: 'android'},
                                },
                            },
                        },
                    },
                ],
            }),
        ])
        await fallbackRuntime.start()

        const fallbackResult = await fallbackRuntime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.platform',
        }), {
            requestId: fallbackRequestId,
        })

        expect(fallbackResult.status).toBe('COMPLETED')
        expect((fallbackResult.actorResults[0]?.result as any)?.result?.output).toEqual({
            variant: 'generic',
        })
    })

    it('updates remote definitions from tdpTopicDataChanged and executes latest definition', async () => {
        const requestId = createRequestId()

        const runtime = createTestRuntime([
            createChildCommandModule(),
            createWorkflowRuntimeModuleV2(),
        ])
        await runtime.start()

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
            topic: 'kernel.workflow.definition',
            changes: [
                {
                    operation: 'upsert',
                    itemKey: 'workflow.remote.print',
                    revision: 1,
                    payload: {
                        workflowKey: 'workflow.remote.print',
                        moduleName: 'remote',
                        name: 'Remote Print V1',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: `${CHILD_MODULE_NAME}.append`,
                                    payload: {value: 'v1'},
                                },
                            },
                        },
                    },
                },
            ],
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
            topic: 'kernel.workflow.definition',
            changes: [
                {
                    operation: 'upsert',
                    itemKey: 'workflow.remote.print',
                    revision: 2,
                    payload: {
                        workflowKey: 'workflow.remote.print',
                        moduleName: 'remote',
                        name: 'Remote Print V2',
                        enabled: true,
                        updatedAt: 2,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: `${CHILD_MODULE_NAME}.append`,
                                    payload: {value: 'v2'},
                                },
                            },
                        },
                    },
                },
            ],
        }))

        const result = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'workflow.remote.print',
        }), {
            requestId,
        })
        const childState = runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof runtime.getState>] as {
            values: string[]
        }

        expect(result.status).toBe('COMPLETED')
        expect(childState.values).toContain('v2')
    })

    it('supports scripts, condition and output mapping', async () => {
        const requestId = createRequestId()

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.scripts',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Script Workflow',
                        enabled: true,
                        rootStep: {
                            stepKey: 'root',
                            name: 'Root',
                            type: 'flow',
                            steps: [
                                {
                                    stepKey: 'compose',
                                    name: 'Compose',
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
                                    name: 'Guarded',
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
        ])
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.scripts',
            input: {
                amount: 10,
            },
        }), {
            requestId,
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('COMPLETED')
        expect((result.actorResults[0]?.result as any)?.result?.output).toEqual({
            passed: true,
        })
        expect((result.actorResults[0]?.result as any)?.result?.stepOutputs?.compose).toEqual({
            label: 'ok-20',
            amount: 10,
        })
        expect((result.actorResults[0]?.result as any)?.result?.variables).toEqual({
            summary: 'summary-20',
        })
        expect(observation?.steps.compose?.output).toEqual({
            label: 'ok-20',
            amount: 10,
        })
        expect(observation?.steps.guarded?.status).toBe('COMPLETED')
    })

    it('supports external-call retry and skip strategies', async () => {
        const retryRequestId = createRequestId()
        const skipRequestId = createRequestId()
        let attempt = 0

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.retry',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
                    {
                        workflowKey: 'test.skip',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
        ], {
            connector: {
                async call(input) {
                    if (input.action === 'demo.skip') {
                        throw new Error('skip me')
                    }
                    attempt += 1
                    if (attempt < 2) {
                        throw new Error('temporary failure')
                    }
                    return {ok: true, attempt}
                },
            },
        })
        await runtime.start()

        const retryResult = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.retry',
        }), {
            requestId: retryRequestId,
        })
        const skipResult = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.skip',
        }), {
            requestId: skipRequestId,
        })

        const retryObservation = selectWorkflowObservationByRequestId(runtime.getState(), retryRequestId)
        const skipObservation = selectWorkflowObservationByRequestId(runtime.getState(), skipRequestId)

        expect(retryResult.status).toBe('COMPLETED')
        expect((retryResult.actorResults[0]?.result as any)?.result?.output).toEqual({
            ok: true,
            attempt: 2,
        })
        expect(retryObservation?.steps.retryable?.retryCount).toBe(1)
        expect(skipResult.status).toBe('COMPLETED')
        expect(skipObservation?.steps['maybe-fail']?.status).toBe('SKIPPED')
        expect(skipObservation?.steps['after-skip']?.status).toBe('COMPLETED')
    })

    it('supports external-subscribe and external-on steps through connector port', async () => {
        const subscribeRequestId = createRequestId()
        const onRequestId = createRequestId()
        const unsubscribed: string[] = []

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.external-subscribe',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
                    {
                        workflowKey: 'test.external-on',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
        ], {
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
        })
        await runtime.start()

        const subscribeResult = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.external-subscribe',
        }), {
            requestId: subscribeRequestId,
        })
        const onResult = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.external-on',
        }), {
            requestId: onRequestId,
        })

        expect(subscribeResult.status).toBe('COMPLETED')
        expect((subscribeResult.actorResults[0]?.result as any)?.result?.output).toEqual({
            source: 'subscription',
            value: 'message-1',
        })
        expect(unsubscribed).toEqual(['subscription-1'])
        expect(onResult.status).toBe('COMPLETED')
        expect((onResult.actorResults[0]?.result as any)?.result?.output).toEqual({
            type: 'terminal.status.changed',
            target: 'printer',
            value: 'matched',
        })
    })

    it('does not unsubscribe with empty subscription id when external-subscribe resolves immediately', async () => {
        const requestId = createRequestId()
        const unsubscribed: string[] = []

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.external-subscribe-immediate',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'External Subscribe Immediate Workflow',
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
        ], {
            connector: {
                async subscribe(input) {
                    input.onMessage({
                        source: 'subscription',
                        value: 'message-now',
                    })
                    return 'subscription-now'
                },
                async unsubscribe(subscriptionId) {
                    unsubscribed.push(subscriptionId)
                },
            },
        })
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.external-subscribe-immediate',
        }), {
            requestId,
        })

        expect(result.status).toBe('COMPLETED')
        expect(unsubscribed).toEqual([])
    })

    it('runs compensation step but keeps workflow terminal status failed', async () => {
        const requestId = createRequestId()

        const runtime = createTestRuntime([
            createChildCommandModule(),
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.compensate',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
                                            commandName: `${CHILD_MODULE_NAME}.append`,
                                            payload: {value: 'rollback-done'},
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            }),
        ], {
            connector: {
                async call(input) {
                    if (input.action === 'demo.fail') {
                        throw new Error('expected failure')
                    }
                    return {compensated: true}
                },
            },
        })
        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.compensate',
        }), {
            requestId,
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)
        const childState = runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof runtime.getState>] as {
            values: string[]
        }

        expect(result.status).toBe('COMPLETED')
        expect((result.actorResults[0]?.result as any)?.status).toBe('FAILED')
        expect(observation?.status).toBe('FAILED')
        expect(observation?.steps.rollback?.status).toBe('COMPLETED')
        expect(observation?.events.some(event => event.type === 'step.compensating')).toBe(true)
        expect(childState.values).toContain('rollback-done')
    })

    it('marks timed out workflow and ignores late step output', async () => {
        const workflowTimeoutRequestId = createRequestId()
        const stepTimeoutRequestId = createRequestId()

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.workflow-timeout',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
                    {
                        workflowKey: 'test.step-timeout',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Step Timeout',
                        enabled: true,
                        rootStep: {
                            stepKey: 'too-slow',
                            name: 'Too Slow',
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
        ])
        await runtime.start()

        const workflowTimeout = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.workflow-timeout',
            options: {
                timeoutMs: 5,
            },
        }), {
            requestId: workflowTimeoutRequestId,
        })
        const stepTimeout = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.step-timeout',
        }), {
            requestId: stepTimeoutRequestId,
        })

        await delay(60)

        const workflowObservation = selectWorkflowObservationByRequestId(runtime.getState(), workflowTimeoutRequestId)
        const stepObservation = selectWorkflowObservationByRequestId(runtime.getState(), stepTimeoutRequestId)

        expect(workflowTimeout.status).toBe('COMPLETED')
        expect((workflowTimeout.actorResults[0]?.result as any)?.status).toBe('TIMED_OUT')
        expect(workflowObservation?.status).toBe('TIMED_OUT')
        expect(workflowObservation?.events.some(event => event.type === 'workflow.timed-out')).toBe(true)
        expect(stepTimeout.status).toBe('COMPLETED')
        expect((stepTimeout.actorResults[0]?.result as any)?.status).toBe('TIMED_OUT')
        expect(stepObservation?.status).toBe('TIMED_OUT')
        expect(stepObservation?.steps['too-slow']?.status).toBe('TIMED_OUT')
        expect(stepObservation?.steps['too-slow']?.output).toBeUndefined()
    })

    it('uses runtime-shell-v2 parameter catalog for default timeouts', async () => {
        const requestId = createRequestId()

        const runtime = createTestRuntime([
            createWorkflowRuntimeModuleV2({
                initialDefinitions: [
                    {
                        workflowKey: 'test.default-step-timeout',
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
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
        ])
        await runtime.start()

        await runtime.dispatchCommand(createCommand(runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries, {
            entries: [
                {
                    key: 'kernel.base.workflow-runtime-v2.default-step-timeout-ms',
                    rawValue: 5,
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            ],
        }))

        const result = await runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'test.default-step-timeout',
        }), {
            requestId,
        })

        const observation = selectWorkflowObservationByRequestId(runtime.getState(), requestId)

        expect(result.status).toBe('COMPLETED')
        expect((result.actorResults[0]?.result as any)?.status).toBe('TIMED_OUT')
        expect(observation?.status).toBe('TIMED_OUT')
        expect(observation?.steps['slow-step']?.status).toBe('TIMED_OUT')
    })
})
