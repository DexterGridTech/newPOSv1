import { Actor } from "@impos2/kernel-core-base";
export declare class InstanceInfoActor extends Actor {
    setInstanceToMaster: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    setInstanceToSlave: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    setDisplayToPrimary: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    setDisplayToSecondary: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    setEnableSlave: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    setDisableSlave: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    setMasterInfo: {
        commandFactory: (value: import("../..").MasterInfo) => import("@impos2/kernel-core-base").Command<import("../..").MasterInfo>;
        handler: (command: import("@impos2/kernel-core-base").Command<import("../..").MasterInfo>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    clearMasterInfo: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=instanceInfo.d.ts.map