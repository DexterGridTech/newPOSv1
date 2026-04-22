import { Actor } from "../../foundations";
import { ValueWithUpdatedAt } from "../../types";
export declare class SystemParametersActor extends Actor {
    updateSystemParameters: {
        commandFactory: (value: Record<string, ValueWithUpdatedAt<any> | null | undefined>) => import("@impos2/kernel-core-base").Command<Record<string, ValueWithUpdatedAt<any> | null | undefined>>;
        handler: (command: import("@impos2/kernel-core-base").Command<Record<string, ValueWithUpdatedAt<any> | null | undefined>>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=systemParameters.d.ts.map