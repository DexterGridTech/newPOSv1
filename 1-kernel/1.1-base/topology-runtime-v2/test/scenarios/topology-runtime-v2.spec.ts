import {describe, expect, it} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    defineCommand,
    onCommand,
    type ActorDefinition,
    type KernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createTopologyRuntimeModuleV2,
    selectTopologyRuntimeV2Context,
    selectTopologyRuntimeV2EnableSlave,
    selectTopologyRuntimeV2InstanceMode,
    selectTopologyRuntimeV2MasterInfo,
    selectTopologyRuntimeV2ServerConnected,
    topologyRuntimeV2CommandDefinitions,
} from '../../src'

const createTestLogger = (moduleName: string) => {
    return createLoggerPort({
        environmentMode: 'DEV',
        write() {},
        scope: {
            moduleName,
            layer: 'kernel',
        },
    })
}

const echoModuleName = 'kernel.base.topology-runtime-v2.test.echo'

const echoCommand = defineCommand<{value: string}>({
    moduleName: echoModuleName,
    commandName: 'echo',
})

const createEchoModule = (): KernelRuntimeModuleV2 => {
    const actorDefinitions: ActorDefinition[] = [
        {
            moduleName: echoModuleName,
            actorName: 'EchoActor',
            handlers: [
                onCommand(echoCommand, context => ({
                    value: context.command.payload.value,
                })),
            ],
        },
    ]

    return {
        moduleName: echoModuleName,
        packageVersion: '0.0.1',
        commandDefinitions: [echoCommand],
        actorDefinitions,
    }
}

describe('topology-runtime-v2', () => {
    it('projects recovery state into readable topology context', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v2.test.context'),
            }),
            modules: [createTopologyRuntimeModuleV2()],
        })

        await runtime.start()

        await runtime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setInstanceMode, {
            instanceMode: 'SLAVE',
        }))
        await runtime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))
        await runtime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setEnableSlave, {
            enableSlave: true,
        }))
        await runtime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setMasterInfo, {
            masterInfo: {
                deviceId: 'master-a',
                serverAddress: [{address: 'ws://127.0.0.1:7788'}],
                addedAt: Date.now() as any,
            },
        }))

        const state = runtime.getState()
        const context = selectTopologyRuntimeV2Context(state)

        expect(context?.instanceMode).toBe('SLAVE')
        expect(context?.workspace).toBe('BRANCH')
        expect(selectTopologyRuntimeV2InstanceMode(state)).toBe('SLAVE')
        expect(selectTopologyRuntimeV2EnableSlave(state)).toBe(true)
        expect(selectTopologyRuntimeV2MasterInfo(state)?.deviceId).toBe('master-a')
    })

    it('fails peer dispatch when assembly is missing', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v2.test.no-assembly'),
            }),
            modules: [createTopologyRuntimeModuleV2()],
        })

        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.dispatchPeerCommand,
            {
                requestId: 'request-a' as any,
                parentCommandId: 'parent-a',
                targetNodeId: 'peer-a',
                commandName: echoCommand.commandName,
                payload: {value: 'hello'},
            },
        ))

        expect(result.status).toBe('FAILED')
    })

    it('routes peer target command through installed peer gateway', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v2.test.peer-gateway'),
            }),
            modules: [
                createTopologyRuntimeModuleV2(),
                createEchoModule(),
            ],
        })

        await runtime.start()
        runtime.installPeerDispatchGateway({
            async dispatchCommand(command) {
                return await runtime.dispatchCommand(command)
            },
        })

        const result = await runtime.dispatchCommand(createCommand(echoCommand, {value: 'ok'}), {
            target: 'peer',
        })

        expect(result.status).toBe('COMPLETED')
        expect(result.actorResults[0]?.actorKey).toBe('runtime-shell-v2.peer-dispatch')
    })

    it('stores remote command completion in request query when mirrored command event is applied', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v2.test.remote-event'),
            }),
            modules: [
                createTopologyRuntimeModuleV2(),
                createEchoModule(),
            ],
        })

        await runtime.start()

        const requestId = 'request_remote_complete' as any
        const commandId = 'command_remote_complete' as any
        runtime.registerMirroredCommand({
            requestId,
            commandId,
            commandName: echoCommand.commandName,
            target: 'peer',
        })
        runtime.applyRemoteCommandEvent({
            envelopeId: 'env_remote_complete' as any,
            sessionId: 'session_remote_complete' as any,
            requestId,
            commandId,
            ownerNodeId: runtime.localNodeId,
            sourceNodeId: 'peer_node' as any,
            eventType: 'completed',
            result: {value: 'from-peer'},
            occurredAt: Date.now() as any,
        })

        expect(runtime.queryRequest(requestId)).toMatchObject({
            status: 'COMPLETED',
            commands: [
                {
                    commandId,
                    commandName: echoCommand.commandName,
                    status: 'COMPLETED',
                    actorResults: [
                        expect.objectContaining({
                            actorKey: 'runtime-shell-v2.remote-event',
                            status: 'COMPLETED',
                            result: {value: 'from-peer'},
                        }),
                    ],
                },
            ],
        })
    })

    it('does not connect automatically without assembly', async () => {
        const runtime = createKernelRuntimeV2({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger('kernel.base.topology-runtime-v2.test.no-connect'),
            }),
            modules: [createTopologyRuntimeModuleV2()],
        })

        await runtime.start()
        expect(selectTopologyRuntimeV2ServerConnected(runtime.getState())).toBe(false)
    })
})
