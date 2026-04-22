import { Command } from "@impos2/kernel-core-base";
import { MasterInfo } from "../../types";
export declare const kernelCoreInterconnectionCommands: {
    shouldSwitchToPrimaryDisplay: (payload: void) => Command<void>;
    shouldSwitchToSecondaryDisplay: (payload: void) => Command<void>;
    setInstanceToMaster: (payload: void) => Command<void>;
    setInstanceToSlave: (payload: void) => Command<void>;
    setDisplayToPrimary: (payload: void) => Command<void>;
    setDisplayToSecondary: (payload: void) => Command<void>;
    setEnableSlave: (payload: void) => Command<void>;
    setDisableSlave: (payload: void) => Command<void>;
    setMasterInfo: (payload: MasterInfo) => Command<MasterInfo>;
    clearMasterInfo: (payload: void) => Command<void>;
    startConnection: (payload: void) => Command<void>;
    connectedToServer: (payload: void) => Command<void>;
    disconnectedFromServer: (payload: string) => Command<string>;
    peerConnected: (payload: string) => Command<string>;
    peerDisconnected: (payload: void) => Command<void>;
    sendToRemoteExecute: (payload: Command<any>) => Command<Command<any>>;
    synStateAtConnected: (payload: Record<string, Record<string, {
        updatedAt: number;
    }>>) => Command<Record<string, Record<string, {
        updatedAt: number;
    }>>>;
};
//# sourceMappingURL=index.d.ts.map