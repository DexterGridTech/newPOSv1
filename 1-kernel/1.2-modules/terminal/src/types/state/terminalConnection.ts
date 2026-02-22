import {ServerConnectionStatus} from "@impos2/kernel-core-interconnection";
export interface TerminalConnectionState {
    serverConnectionStatus:ServerConnectionStatus
    connectedAt?: number | null
    disconnectedAt?: number | null
    connectionError?: string | null
    connectionHistory: {
        connectedAt: number
        disconnectedAt: number
        connectionError: string
    }[]
}