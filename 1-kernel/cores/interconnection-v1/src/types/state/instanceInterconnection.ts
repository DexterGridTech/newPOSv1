import {ServerConnectionStatus, SlaveConnection} from "../shared";

export interface InstanceInterconnectionState {
    serverConnectionStatus: ServerConnectionStatus
    startToSync: boolean
    connectedAt?: number | null
    disconnectedAt?: number | null
    connectionError?: string | null
    connectionHistory: {
        connectedAt: number
        disconnectedAt: number
        connectionError: string
    }[]
    master: {
        slaveConnectionHistory: SlaveConnection[]
        slaveConnection?:SlaveConnection
    }
}