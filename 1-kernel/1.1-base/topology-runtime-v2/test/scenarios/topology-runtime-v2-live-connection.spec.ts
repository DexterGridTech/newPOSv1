import {afterEach, describe, expect, it} from 'vitest'
import {createEnvelopeId} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    defineCommand,
    onCommand,
    type ActorDefinition,
    type KernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2Peer,
    selectTopologyRuntimeV2RequestProjection,
    topologyRuntimeV2CommandDefinitions,
} from '../../src'
import {createTopologyRuntimeV2LiveHarness, waitFor} from '../helpers/liveHarness'

const liveServers: Array<{close: () => Promise<void>}> = []

afterEach(async () => {
    await Promise.all(liveServers.splice(0).map(server => server.close()))
})

const blockingModuleName = 'kernel.base.topology-runtime-v2.test.blocking'
const rootModuleName = 'kernel.base.topology-runtime-v2.test.root'

const blockingEchoCommand = defineCommand<{peer: string}>({
    moduleName: blockingModuleName,
    commandName: 'blocking-echo',
})

const rootCommand = defineCommand<{owner: string}>({
    moduleName: rootModuleName,
    commandName: 'root',
})

const createBlockingEchoModule = (releaseExecution: Promise<void>): KernelRuntimeModuleV2 => {
    const actorDefinitions: ActorDefinition[] = [
        {
            moduleName: blockingModuleName,
            actorName: 'BlockingEchoActor',
            handlers: [
                onCommand(blockingEchoCommand, async context => {
                    await releaseExecution
                    return {
                        payload: {
                            peer: context.command.payload.peer,
                        },
                    }
                }),
            ],
        },
    ]

    return {
        moduleName: blockingModuleName,
        packageVersion: '0.0.1',
        commandDefinitions: [blockingEchoCommand],
        actorDefinitions,
    }
}

const createRootModule = (): KernelRuntimeModuleV2 => {
    const actorDefinitions: ActorDefinition[] = [
        {
            moduleName: rootModuleName,
            actorName: 'RootActor',
            handlers: [
                onCommand(rootCommand, context => ({
                    payload: {
                        owner: context.command.payload.owner,
                    },
                })),
            ],
        },
    ]

    return {
        moduleName: rootModuleName,
        packageVersion: '0.0.1',
        commandDefinitions: [rootCommand],
        actorDefinitions,
    }
}

describe('topology-runtime-v2 live connection', () => {
    it('connects to dual-topology-host and receives hello ack peer info', async () => {
        const harness = await createTopologyRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.live',
        })
        liveServers.push(harness)

        const masterRuntime = harness.createMasterRuntime()
        const slaveRuntime = harness.createSlaveRuntime()

        await masterRuntime.start()
        await slaveRuntime.start()

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setEnableSlave, {
            enableSlave: true,
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setInstanceMode, {
            instanceMode: 'SLAVE',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setMasterInfo, {
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: harness.addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        }))

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))

        await waitFor(() => {
            return selectTopologyRuntimeV2Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyRuntimeV2Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        }, 5_000)

        expect(selectTopologyRuntimeV2Peer(masterRuntime.getState())?.peerNodeId).toBeTruthy()
        expect(selectTopologyRuntimeV2Peer(slaveRuntime.getState())?.peerNodeId).toBeTruthy()
    })

    it('applies projection mirror to owner read model over real dual-topology host relay', async () => {
        const harness = await createTopologyRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.projection-mirror',
        })
        liveServers.push(harness)

        const masterRuntime = harness.createMasterRuntime()
        const slaveRuntime = harness.createSlaveRuntime()

        await masterRuntime.start()
        await slaveRuntime.start()

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setEnableSlave, {
            enableSlave: true,
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setInstanceMode, {
            instanceMode: 'SLAVE',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setMasterInfo, {
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: harness.addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        }))

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))

        await waitFor(() => {
            return selectTopologyRuntimeV2Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyRuntimeV2Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        }, 5_000)

        const requestId = 'projection_mirror_request' as any
        masterRuntime.applyRequestLifecycleSnapshot({
            requestId,
            ownerNodeId: harness.masterNodeId as any,
            rootCommandId: 'projection_mirror_root' as any,
            sessionId: 'projection_mirror_session' as any,
            status: 'complete',
            startedAt: Date.now() as any,
            updatedAt: (Date.now() + 10) as any,
            commands: [
                {
                    commandId: 'projection_mirror_root' as any,
                    ownerNodeId: harness.masterNodeId as any,
                    sourceNodeId: harness.masterNodeId as any,
                    targetNodeId: harness.masterNodeId as any,
                    commandName: 'kernel.base.topology-runtime-v2.test.local',
                    status: 'complete',
                    result: {
                        payload: {
                            from: 'owner',
                        },
                    },
                    startedAt: Date.now() as any,
                    updatedAt: (Date.now() + 10) as any,
                },
            ],
            commandResults: [],
        })

        const sessionId = 'projection_mirror_session' as any
        harness.slaveSocketRuntime.send('dual-topology.ws.topology-runtime-v2.projection-mirror', {
            type: 'projection-mirror',
            envelope: {
                envelopeId: createEnvelopeId(),
                sessionId,
                ownerNodeId: harness.masterNodeId as any,
                projection: {
                    requestId,
                    ownerNodeId: harness.masterNodeId as any,
                    status: 'complete',
                    startedAt: Date.now() as any,
                    updatedAt: (Date.now() + 10) as any,
                    resultsByCommand: {},
                    mergedResults: {
                        payload: {
                            from: 'owner-mirror',
                        },
                    },
                    errorsByCommand: {},
                    pendingCommandCount: 0,
                },
                mirroredAt: Date.now() as any,
            },
        })

        await waitFor(() => {
            const projection = selectTopologyRuntimeV2RequestProjection(masterRuntime.getState(), requestId)
            const mergedResults = projection?.mergedResults as {payload?: {from?: string}} | undefined
            return mergedResults?.payload?.from === 'owner-mirror'
        })

        expect(selectTopologyRuntimeV2RequestProjection(masterRuntime.getState(), requestId)?.mergedResults).toEqual({
            payload: {
                from: 'owner-mirror',
            },
        })
    })

    it('dispatches remote command through public topology command and keeps request pending until peer completes', async () => {
        const harness = await createTopologyRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.public-command',
        })
        liveServers.push(harness)

        const masterRuntime = harness.createMasterRuntime([
            createRootModule(),
        ])
        const releaseExecution = new Promise<void>(resolve => setTimeout(resolve, 150))
        const slaveRuntime = harness.createSlaveRuntime([
            createBlockingEchoModule(releaseExecution),
        ])

        await masterRuntime.start()
        await slaveRuntime.start()

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setEnableSlave, {
            enableSlave: true,
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setInstanceMode, {
            instanceMode: 'SLAVE',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setMasterInfo, {
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: harness.addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        }))

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))

        await waitFor(() => {
            return selectTopologyRuntimeV2Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyRuntimeV2Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        }, 5_000)

        const rootResult = await masterRuntime.dispatchCommand(createCommand(rootCommand, {
            owner: 'root',
        }))
        expect(rootResult.status).toBe('COMPLETED')

        const rootRequestId = rootResult.requestId
        const rootCommandId = rootResult.commandId

        const dispatchResult = await masterRuntime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.dispatchPeerCommand,
            {
                requestId: rootRequestId,
                parentCommandId: rootCommandId,
                targetNodeId: harness.slaveNodeId,
                commandName: blockingEchoCommand.commandName,
                payload: {peer: 'done'},
            },
        ))

        expect(dispatchResult.status).toBe('COMPLETED')
        const remoteCommandId = (dispatchResult.actorResults[0]?.result as {commandId?: string} | undefined)?.commandId
        expect(remoteCommandId).toBeTruthy()

        await waitFor(() => {
            const request = masterRuntime.queryRequest(rootRequestId)
            const command = request?.commands.find(item => item.commandId === remoteCommandId)
            return Boolean(command && command.completedAt)
        }, 5_000)

        const request = masterRuntime.queryRequest(rootRequestId)
        const remoteCommand = request?.commands.find(item => item.commandId === remoteCommandId)
        expect(remoteCommand?.actorResults.some(item => item.result?.payload)).toBe(true)
    })
})
