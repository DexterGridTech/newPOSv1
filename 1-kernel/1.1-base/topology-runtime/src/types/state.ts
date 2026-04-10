import type {TimestampMs} from '@impos2/kernel-base-contracts'

export interface TopologyMasterAddress {
    address: string
}

export interface TopologyMasterInfo {
    deviceId: string
    serverAddress: TopologyMasterAddress[]
    addedAt: TimestampMs
}

export interface TopologyRecoveryState {
    instanceMode?: string
    displayMode?: string
    enableSlave?: boolean
    masterInfo?: TopologyMasterInfo | null
}
