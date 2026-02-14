import {ServerAddress} from "./connection";

export interface MasterInfo {
    name: string;
    deviceId: string;
    serverAddress: ServerAddress[];
    addedAt: number
}

export const MasterServerMessageType = {
    SYNC_STATE: 'SYNC_STATE',
    REMOTE_COMMAND: 'REMOTE_COMMAND',
    REMOTE_COMMAND_EXECUTED: 'REMOTE_COMMAND_EXECUTED'
} as const;

export interface SyncStateWrapper {
    key:string
    stateChanged:Record<string, { oldValue: any; newValue: any }>
    targetDevice:string|null
}
