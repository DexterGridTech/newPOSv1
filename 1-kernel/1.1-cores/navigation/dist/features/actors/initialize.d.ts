import { Actor } from "@impos2/kernel-core-base";
export declare class InitializeActor extends Actor {
    initialize: {
        commandFactory: (value: void) => import("@impos2/kernel-core-base").Command<void>;
        handler: (command: import("@impos2/kernel-core-base").Command<void>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=initialize.d.ts.map