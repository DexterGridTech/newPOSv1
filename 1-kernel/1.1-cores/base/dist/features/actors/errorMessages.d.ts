import { Actor } from "../../foundations";
import { ValueWithUpdatedAt } from "../../types";
export declare class ErrorMessagesActor extends Actor {
    updateErrorMessages: {
        commandFactory: (value: Record<string, ValueWithUpdatedAt<string> | null | undefined>) => import("@impos2/kernel-core-base").Command<Record<string, ValueWithUpdatedAt<string> | null | undefined>>;
        handler: (command: import("@impos2/kernel-core-base").Command<Record<string, ValueWithUpdatedAt<string> | null | undefined>>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=errorMessages.d.ts.map