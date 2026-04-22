import { Actor } from "@impos2/kernel-core-base";
export declare class UiVariableActor extends Actor {
    setUiVariables: {
        commandFactory: (value: Record<string, any>) => import("@impos2/kernel-core-base").Command<Record<string, any>>;
        handler: (command: import("@impos2/kernel-core-base").Command<Record<string, any>>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    clearUiVariables: {
        commandFactory: (value: string[]) => import("@impos2/kernel-core-base").Command<string[]>;
        handler: (command: import("@impos2/kernel-core-base").Command<string[]>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=uiVariable.d.ts.map