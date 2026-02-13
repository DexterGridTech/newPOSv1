import {ServerConnectionStatus} from "../shared/connection";


export interface SlaveInterconnectionState {
    connectionStatus: ServerConnectionStatus
    connectedAt?: number
    disconnectedAt?: number
    connectionError?: string
    connectionHistory?: {
        connectedAt: number
        disconnectedAt: number
        connectionError: string
    }[]
}