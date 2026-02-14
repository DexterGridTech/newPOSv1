import {ServerConnectionStatus} from "../shared/connection";


export interface SlaveInterconnectionState {
    serverConnectionStatus: ServerConnectionStatus
    connectedAt?: number | null
    disconnectedAt?: number| null
    connectionError?: string| null
    connectionHistory: {
        connectedAt: number
        disconnectedAt: number
        connectionError: string
    }[]
}