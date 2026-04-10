import type {NodeRuntimeInfo} from '@impos2/kernel-base-contracts'
import type {LogEvent} from '@impos2/kernel-base-platform-ports'
import {moduleName} from '../moduleName'
import type {CreateDualTopologyHostInput, DualTopologyHost} from '../types/hostShell'
import {runtimeContracts, runtimeHostRuntime, runtimePlatformPorts} from './runtimeDeps'

const createDefaultHostRuntimeInfo = (): NodeRuntimeInfo => {
    return {
        nodeId: runtimeContracts.createNodeId(),
        deviceId: 'dual-topology-node-host',
        role: 'master',
        platform: 'node',
        product: 'new-pos-mock-host',
        assemblyAppId: 'mock.dual-topology-host',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: 'host-runtime-1',
        protocolVersion: '2026.04',
        capabilities: [
            'host-pairing',
            'host-observe',
            'fault-injection',
            'dispatch-relay',
            'projection-mirror',
        ],
    }
}

const createDefaultLogger = () => {
    return runtimePlatformPorts.createLoggerPort({
        environmentMode: process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV',
        write(event: LogEvent) {
            const writer = event.level === 'error'
                ? console.error
                : event.level === 'warn'
                    ? console.warn
                    : console.log

            writer(JSON.stringify(event))
        },
        scope: {
            moduleName,
            layer: 'mock-server',
        },
    })
}

export const createDualTopologyHost = (
    input: CreateDualTopologyHostInput = {},
): DualTopologyHost => {
    const hostRuntimeInfo = input.hostRuntime ?? createDefaultHostRuntimeInfo()
    const logger = input.logger ?? createDefaultLogger()

    const hostRuntime = runtimeHostRuntime.createHostRuntime({
        hostRuntime: hostRuntimeInfo,
        logger,
        requiredCapabilities: input.requiredCapabilities,
        heartbeatTimeoutMs: input.heartbeatTimeoutMs,
        maxObservationEvents: input.maxObservationEvents,
    })

    return {
        hostRuntime,
        logger,
        getHostRuntimeInfo() {
            return hostRuntimeInfo
        },
    }
}
