import {ServerConnectionStatus} from "@impos2/kernel-core-interconnection";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
export interface TerminalConnectionState {
    serverConnectionStatus:ValueWithUpdatedAt<ServerConnectionStatus>
    connectedAt?: ValueWithUpdatedAt<number|null>
    disconnectedAt?: ValueWithUpdatedAt<number|null>
    connectionError?: ValueWithUpdatedAt<string|null>
    connectionHistory: ValueWithUpdatedAt<{
        connectedAt: number
        disconnectedAt: number
        connectionError: string
    }[]>
}