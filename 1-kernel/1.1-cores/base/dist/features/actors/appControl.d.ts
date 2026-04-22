import { Actor } from "../../foundations";
export declare class AppControlActor extends Actor {
    clearDataCache: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    switchServerSpace: {
        commandFactory: (value: string) => import("@impos2/kernel-core-base").Command<string>;
        handler: (command: import("@impos2/kernel-core-base").Command<string>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=appControl.d.ts.map