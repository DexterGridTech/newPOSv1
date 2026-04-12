import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpBindingSnapshot, selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime'
import {selectWorkflowDefinition, workflowRuntimeCommandNames, createWorkflowRuntimeModule} from '../../src'
import {
    createLivePlatform,
    createLiveRuntime,
    activateAndConnectLiveRuntime,
    waitFor,
} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/tdp-sync-runtime/test/helpers/liveHarness'
import {createChildCommandModule, CHILD_SLICE} from '../helpers/workflowRuntimeTestHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('workflow-runtime live remote definitions', () => {
    it('updates executable workflow definitions from TDP topic add/update/delete', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const harness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule(),
            ],
        })

        await harness.runtime.start()
        await activateAndConnectLiveRuntime(harness.runtime, {
            activationCode: '200000000007',
            deviceId: 'device-workflow-remote-001',
        })

        const terminalId = selectTcpTerminalId(harness.runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id for workflow remote definition test')
        }

        const definitionId = 'workflow.remote.print'
        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: definitionId,
                    payload: {
                        definitionId,
                        workflowKey: 'workflow.remote.print',
                        moduleName: 'kernel.base.workflow-runtime.test',
                        name: 'Remote Print V1',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                    payload: {value: 'v1'},
                                },
                            },
                        },
                    },
                },
            ],
        })

        await waitFor(() => selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.print').length === 1, 5_000)

        const firstRun = await harness.runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId: createRequestId(),
            payload: {
                workflowKey: 'workflow.remote.print',
            },
        })

        const childStateAfterFirstRun = harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }

        expect(firstRun.status).toBe('completed')
        expect(firstRun.status === 'completed' ? firstRun.result?.status : undefined).toBe('COMPLETED')
        expect(childStateAfterFirstRun.values).toContain('v1')

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: definitionId,
                    payload: {
                        definitionId,
                        workflowKey: 'workflow.remote.print',
                        moduleName: 'kernel.base.workflow-runtime.test',
                        name: 'Remote Print V2',
                        enabled: true,
                        updatedAt: 2,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                    payload: {value: 'v2'},
                                },
                            },
                        },
                    },
                },
            ],
        })

        await waitFor(() => {
            const definitions = selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.print')
            return definitions[0]?.updatedAt === 2
        }, 5_000)

        const secondRun = await harness.runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId: createRequestId(),
            payload: {
                workflowKey: 'workflow.remote.print',
            },
        })

        const childStateAfterSecondRun = harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }

        expect(secondRun.status).toBe('completed')
        expect(secondRun.status === 'completed' ? secondRun.result?.status : undefined).toBe('COMPLETED')
        expect(childStateAfterSecondRun.values).toContain('v2')

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: definitionId,
                    payload: {},
                },
            ],
        })

        await waitFor(() => selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.print').length === 0, 5_000)

        const thirdRun = await harness.runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId: createRequestId(),
            payload: {
                workflowKey: 'workflow.remote.print',
            },
        })

        expect(selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.print')).toEqual([])
        expect(thirdRun.status).toBe('failed')
        expect(thirdRun.status === 'failed' ? thirdRun.error?.key : undefined).toBe(
            'kernel.base.workflow-runtime.workflow_step_failed',
        )
    })

    it('resolves remote workflow definitions by scope priority and falls back after high-priority delete', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const harness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule(),
            ],
        })

        await harness.runtime.start()
        await activateAndConnectLiveRuntime(harness.runtime, {
            activationCode: '200000000004',
            deviceId: 'device-workflow-remote-priority-001',
        })

        const terminalId = selectTcpTerminalId(harness.runtime.getState())
        const binding = selectTcpBindingSnapshot(harness.runtime.getState())
        if (!terminalId || !binding.storeId) {
            throw new Error('missing topology binding for workflow priority test')
        }

        const definitionId = 'workflow.remote.priority'
        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'STORE',
                    scopeKey: binding.storeId,
                    itemKey: definitionId,
                    payload: {
                        definitionId,
                        workflowKey: 'workflow.remote.priority',
                        moduleName: 'kernel.base.workflow-runtime.test',
                        name: 'Remote Priority Store',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                    payload: {value: 'store-v1'},
                                },
                            },
                        },
                    },
                },
                {
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: definitionId,
                    payload: {
                        definitionId,
                        workflowKey: 'workflow.remote.priority',
                        moduleName: 'kernel.base.workflow-runtime.test',
                        name: 'Remote Priority Terminal',
                        enabled: true,
                        updatedAt: 2,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                    payload: {value: 'terminal-v2'},
                                },
                            },
                        },
                    },
                },
            ],
        })

        await waitFor(() => {
            const definitions = selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.priority')
            return definitions.length === 1 && definitions[0]?.updatedAt === 2
        }, 5_000)

        const firstRun = await harness.runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId: createRequestId(),
            payload: {
                workflowKey: 'workflow.remote.priority',
            },
        })

        expect(firstRun.status).toBe('completed')
        expect(firstRun.status === 'completed' ? firstRun.result?.status : undefined).toBe('COMPLETED')
        expect((harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }).values).toContain('terminal-v2')

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: definitionId,
                    payload: {},
                },
            ],
        })

        await waitFor(() => {
            const definitions = selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.priority')
            return definitions.length === 1 && definitions[0]?.updatedAt === 1
        }, 5_000)

        const secondRun = await harness.runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId: createRequestId(),
            payload: {
                workflowKey: 'workflow.remote.priority',
            },
        })

        expect(secondRun.status).toBe('completed')
        expect(secondRun.status === 'completed' ? secondRun.result?.status : undefined).toBe('COMPLETED')
        expect((harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }).values).toContain('store-v1')
    })

    it('keeps module definitions available when remote definitions update another workflow key', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const harness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [
                createChildCommandModule(),
                createWorkflowRuntimeModule({
                    initialDefinitions: [
                        {
                            workflowKey: 'workflow.local.keep',
                            moduleName: 'kernel.base.workflow-runtime.test',
                            name: 'Local Keep Workflow',
                            enabled: true,
                            rootStep: {
                                stepKey: 'append',
                                name: 'Append',
                                type: 'command',
                                input: {
                                    value: {
                                        commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                        payload: {value: 'local-keep'},
                                    },
                                },
                            },
                        },
                    ],
                }),
            ],
        })

        await harness.runtime.start()
        await activateAndConnectLiveRuntime(harness.runtime, {
            activationCode: '200000000007',
            deviceId: 'device-workflow-local-keep-001',
        })

        const terminalId = selectTcpTerminalId(harness.runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id for workflow local keep test')
        }

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'kernel.workflow.definition',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'workflow.remote.other',
                    payload: {
                        definitionId: 'workflow.remote.other',
                        workflowKey: 'workflow.remote.other',
                        moduleName: 'kernel.base.workflow-runtime.test',
                        name: 'Remote Other Workflow',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime.test.child-command.append',
                                    payload: {value: 'remote-other'},
                                },
                            },
                        },
                    },
                },
            ],
        })

        await waitFor(() => selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.other').length === 1, 5_000)

        const localRun = await harness.runtime.execute({
            commandName: workflowRuntimeCommandNames.runWorkflow,
            requestId: createRequestId(),
            payload: {
                workflowKey: 'workflow.local.keep',
            },
        })

        expect(localRun.status).toBe('completed')
        expect(localRun.status === 'completed' ? localRun.result?.status : undefined).toBe('COMPLETED')
        expect((harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }).values).toContain('local-keep')
    })
})
