export const MasterServerMessageType = {
    SYNC_STATE: 'SYNC_STATE',
    REMOTE_COMMAND: 'REMOTE_COMMAND',
    REMOTE_COMMAND_EXECUTED: 'REMOTE_COMMAND_EXECUTED'
} as const;

export interface SyncStateWrapper {
    key:string
    stateChanged:Record<string, { oldValue: any; newValue: any }>
}
export interface RemoteCommand {
    commandId:string;
    commandName: string;
    payload: any;
    requestId: string;
    sessionId: string;
    extra:Record<string, any>
}