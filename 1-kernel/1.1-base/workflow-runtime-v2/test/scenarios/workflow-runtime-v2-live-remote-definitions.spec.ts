import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTdpProjectionByTopicAndBucket,
    selectTerminalGroupMembership,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {
    createWorkflowRuntimeModuleV2,
    selectWorkflowDefinition,
    workflowRuntimeV2CommandDefinitions,
} from '../../src'
import {
    createChildCommandModule,
    CHILD_SLICE,
} from '../helpers/workflowRuntimeV2Harness'
import {
    activateAndConnectLiveRuntime,
    createLivePlatform,
    createLiveRuntime,
    readTerminalScope,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('workflow-runtime-v2 live remote definitions', () => {
    it('updates executable workflow definitions from TDP topic add update delete', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const harness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [
                createChildCommandModule(),
                createWorkflowRuntimeModuleV2(),
            ],
        })

        await harness.runtime.start()
        await activateAndConnectLiveRuntime(harness.runtime, {
            sandboxId: platform.prepare.sandboxId,
            activationCode: '200000000007',
            deviceId: 'device-workflow-v2-remote-001',
        })

        const {terminalId} = readTerminalScope(harness.runtime)
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
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Remote Print V1',
                        enabled: true,
                        updatedAt: 1,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime-v2.test.child-command.append',
                                    payload: {value: 'v1'},
                                },
                            },
                        },
                    },
                },
            ],
        })

        await waitFor(() => Boolean(selectTdpProjectionByTopicAndBucket(harness.runtime.getState(), {
            topic: 'kernel.workflow.definition',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: definitionId,
        })), 5_000)

        await waitFor(() => selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.print').length === 1, 5_000)

        const firstRun = await harness.runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'workflow.remote.print',
        }), {
            requestId: createRequestId(),
        })

        const childStateAfterFirstRun = harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }

        expect(firstRun.status).toBe('COMPLETED')
        expect((firstRun.actorResults[0]?.result as any)?.status).toBe('COMPLETED')
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
                        moduleName: 'kernel.base.workflow-runtime-v2.test',
                        name: 'Remote Print V2',
                        enabled: true,
                        updatedAt: 2,
                        rootStep: {
                            stepKey: 'append',
                            name: 'Append',
                            type: 'command',
                            input: {
                                value: {
                                    commandName: 'kernel.base.workflow-runtime-v2.test.child-command.append',
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

        const secondRun = await harness.runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'workflow.remote.print',
        }), {
            requestId: createRequestId(),
        })

        const childStateAfterSecondRun = harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }

        expect(secondRun.status).toBe('COMPLETED')
        expect((secondRun.actorResults[0]?.result as any)?.status).toBe('COMPLETED')
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

        const thirdRun = await harness.runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'workflow.remote.print',
        }), {
            requestId: createRequestId(),
        })

        expect(selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.print')).toEqual([])
        expect(thirdRun.status).toBe('COMPLETED')
        expect((thirdRun.actorResults[0]?.result as any)?.status).toBe('FAILED')
        expect((thirdRun.actorResults[0]?.result as any)?.error?.key).toBe(
            'kernel.base.workflow-runtime-v2.workflow_definition_not_found',
        )
    }, 20_000)

    it('consumes workflow definitions delivered by GROUP scope policy', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const harness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [
                createChildCommandModule(),
                createWorkflowRuntimeModuleV2(),
            ],
        })

        await harness.runtime.start()
        await activateAndConnectLiveRuntime(harness.runtime, {
            sandboxId: platform.prepare.sandboxId,
            activationCode: '200000000008',
            deviceId: 'device-workflow-v2-group-001',
        })

        const {terminalId, binding} = readTerminalScope(harness.runtime)
        const definitionId = 'workflow.remote.group'

        const group = await platform.admin.createSelectorGroup({
            groupCode: 'workflow-live-group',
            name: 'Workflow Live Group',
            description: 'match live template for workflow group policy test',
            enabled: true,
            priority: 100,
            selectorDslJson: {
                match: {
                    templateId: [binding.templateId],
                },
            },
        })

        await platform.admin.recomputeGroupsByScope({
            scopeType: 'TERMINAL',
            scopeKeys: [terminalId],
        })

        await waitFor(async () => {
            const memberships = await platform.admin.terminalGroupMemberships(terminalId)
            return memberships.groups.some((item: {groupId: string}) => item.groupId === group.groupId)
        }, 5_000)
        await waitFor(() => {
            return selectTerminalGroupMembership(harness.runtime.getState())?.groups.some(item => item.groupId === group.groupId) === true
        }, 5_000)

        await platform.admin.createProjectionPolicy({
            topicKey: 'kernel.workflow.definition',
            itemKey: definitionId,
            scopeType: 'GROUP',
            scopeKey: group.groupId,
            enabled: true,
            payloadJson: {
                definitionId,
                workflowKey: 'workflow.remote.group',
                moduleName: 'kernel.base.workflow-runtime-v2.test',
                name: 'Remote Group Workflow',
                enabled: true,
                updatedAt: 11,
                rootStep: {
                    stepKey: 'append',
                    name: 'Append',
                    type: 'command',
                    input: {
                        value: {
                            commandName: 'kernel.base.workflow-runtime-v2.test.child-command.append',
                            payload: {value: 'group-v1'},
                        },
                    },
                },
            },
            description: 'workflow group policy',
        })

        await waitFor(() => Boolean(selectTdpProjectionByTopicAndBucket(harness.runtime.getState(), {
            topic: 'kernel.workflow.definition',
            scopeType: 'GROUP',
            scopeId: group.groupId,
            itemKey: definitionId,
        })), 5_000)

        await waitFor(() => selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.group').length === 1, 5_000)

        const run = await harness.runtime.dispatchCommand(createCommand(workflowRuntimeV2CommandDefinitions.runWorkflow, {
            workflowKey: 'workflow.remote.group',
        }), {
            requestId: createRequestId(),
        })

        const childState = harness.runtime.getState()[CHILD_SLICE as keyof ReturnType<typeof harness.runtime.getState>] as {
            values: string[]
        }

        expect(run.status).toBe('COMPLETED')
        expect((run.actorResults[0]?.result as any)?.status).toBe('COMPLETED')
        expect(childState.values).toContain('group-v1')
        expect(selectWorkflowDefinition(harness.runtime.getState(), 'workflow.remote.group')[0]).toMatchObject({
            workflowKey: 'workflow.remote.group',
            updatedAt: 11,
            enabled: true,
        })
    }, 20_000)
})
