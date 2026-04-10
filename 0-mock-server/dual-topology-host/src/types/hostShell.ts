import type {NodeRuntimeInfo} from '@impos2/kernel-base-contracts'
import type {HostRuntime} from '@impos2/kernel-base-host-runtime'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'

export interface CreateDualTopologyHostInput {
    hostRuntime?: NodeRuntimeInfo
    logger?: LoggerPort
    requiredCapabilities?: readonly string[]
    heartbeatTimeoutMs?: number
    maxObservationEvents?: number
}

export interface DualTopologyHost {
    hostRuntime: HostRuntime
    logger: LoggerPort
    getHostRuntimeInfo(): NodeRuntimeInfo
}
