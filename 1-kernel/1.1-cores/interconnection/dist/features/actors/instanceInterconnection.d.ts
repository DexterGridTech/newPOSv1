import { Actor, Command } from "@impos2/kernel-core-base";
export declare class InstanceInterconnectionActor extends Actor {
    private connectCount;
    private remoteCommandResponse;
    private websocketInitiated;
    startConnection: {
        commandFactory: (value: void) => Command<void>;
        handler: (command: Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    connectedToServer: {
        commandFactory: (value: void) => Command<void>;
        handler: (command: Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    disconnectedFromServer: {
        commandFactory: (value: string) => Command<string>;
        handler: (command: Command<string>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    peerConnected: {
        commandFactory: (value: string) => Command<string>;
        handler: (command: Command<string>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    peerDisconnected: {
        commandFactory: (value: void) => Command<void>;
        handler: (command: Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    synStateAtConnected: {
        commandFactory: (value: Record<string, Record<string, {
            updatedAt: number;
        }>>) => Command<Record<string, Record<string, {
            updatedAt: number;
        }>>>;
        handler: (command: Command<Record<string, Record<string, {
            updatedAt: number;
        }>>>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    sendToRemoteExecute: {
        commandFactory: (value: Command<any>) => Command<Command<any>>;
        handler: (command: Command<Command<any>>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    private connectToServer;
    private precheckMaster;
    private precheckSlave;
    private getWsClient;
    private initializeWebsocket;
    private syncStateFromRemote;
    private executeRemoteCommand;
    private remoteCommandExecuted;
}
//# sourceMappingURL=instanceInterconnection.d.ts.map