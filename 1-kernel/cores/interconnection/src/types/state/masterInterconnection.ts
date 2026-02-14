import {ServerAddress, ServerConnectionStatus} from "../shared/connection";
import {SlaveConnection} from "../shared/slaveInfo";

export interface MasterInterconnectionState {
    serverConnectionStatus:ServerConnectionStatus
    slaveConnection?:SlaveConnection
    slaveConnectionHistory:SlaveConnection[]
    connectedAt?: number | null
    disconnectedAt?: number| null
    connectionError?: string| null
    connectionHistory: {
        connectedAt: number
        disconnectedAt: number
        connectionError: string
    }[]
}