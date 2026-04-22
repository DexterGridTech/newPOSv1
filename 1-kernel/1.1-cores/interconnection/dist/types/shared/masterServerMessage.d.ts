export declare const MasterServerMessageType: {
    readonly SYNC_STATE: "SYNC_STATE";
    readonly REMOTE_COMMAND: "REMOTE_COMMAND";
    readonly REMOTE_COMMAND_EXECUTED: "REMOTE_COMMAND_EXECUTED";
};
export interface SyncStateWrapper {
    key: string;
    stateChanged: Record<string, any>;
}
export interface RemoteCommand {
    commandId: string;
    commandName: string;
    payload: any;
    requestId: string;
    sessionId: string;
    extra: Record<string, any>;
}
//# sourceMappingURL=masterServerMessage.d.ts.map