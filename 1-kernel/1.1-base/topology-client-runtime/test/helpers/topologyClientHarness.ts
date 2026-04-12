import {afterEach} from 'vitest'
import type {
    NodeHello,
    NodeRuntimeInfo,
} from '@impos2/kernel-base-contracts'
import {createDualTopologyHostServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'

export const topologyClientTestServers: Array<ReturnType<typeof createDualTopologyHostServer>> = []

export const installTopologyClientServerCleanup = () => {
    afterEach(async () => {
        await Promise.all(topologyClientTestServers.splice(0).map(server => server.close()))
    })
}

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

export const createRuntimeInfo = (input: {
    nodeId: string
    deviceId: string
    role: 'master' | 'slave'
}): NodeRuntimeInfo => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        role: input.role,
        platform: 'node',
        product: 'new-pos-test',
        assemblyAppId: 'assembly.test',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: '1.0.0',
        protocolVersion: '2026.04',
        capabilities: ['projection-mirror', 'dispatch-relay'],
    }
}

export const createHello = (ticketToken: string, runtime: NodeRuntimeInfo): NodeHello => {
    return {
        helloId: `hello_${runtime.nodeId}`,
        ticketToken,
        runtime,
        sentAt: Date.now() as any,
    }
}

export const createEchoModule = (): KernelRuntimeModule => {
    return {
        moduleName: 'kernel.base.topology-client-runtime.test.echo-module',
        packageVersion: '0.0.1',
        install(context) {
            context.registerHandler('kernel.base.topology-client-runtime.test.echo', async handlerContext => {
                return {
                    payload: handlerContext.command.payload as Record<string, unknown>,
                }
            })
        },
    }
}

export const createBlockingEchoModule = (input: {
    releaseExecution: Promise<void>
}): KernelRuntimeModule => {
    return {
        moduleName: 'kernel.base.topology-client-runtime.test.blocking-echo-module',
        packageVersion: '0.0.1',
        install(context) {
            context.registerHandler('kernel.base.topology-client-runtime.test.blocking-echo', async handlerContext => {
                await input.releaseExecution
                return {
                    payload: handlerContext.command.payload as Record<string, unknown>,
                }
            })
        },
    }
}
