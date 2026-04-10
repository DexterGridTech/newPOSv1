import type {NodeHello, NodeRuntimeInfo} from '@impos2/kernel-base-contracts'

export const createRuntimeInfo = (input: {
    nodeId: string
    deviceId: string
    role: 'master' | 'slave'
    capabilities?: string[]
    runtimeVersion?: string
}): NodeRuntimeInfo => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        role: input.role,
        platform: 'android',
        product: 'new-pos',
        assemblyAppId: 'assembly.app',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: input.runtimeVersion ?? '1.0.0',
        protocolVersion: '2026.04',
        capabilities: [...(input.capabilities ?? ['projection-mirror', 'dispatch-relay'])],
    }
}

export const createHello = (ticketToken: string, runtime: NodeRuntimeInfo): NodeHello => {
    return {
        helloId: `hello_${runtime.nodeId}`,
        ticketToken,
        runtime,
        sentAt: Date.now(),
    }
}
