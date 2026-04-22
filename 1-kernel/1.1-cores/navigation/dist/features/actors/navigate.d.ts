import { Actor } from "@impos2/kernel-core-base";
export declare class NavigateActor extends Actor {
    navigateTo: {
        commandFactory: (value: {
            target: import("@impos2/kernel-core-base").ScreenPart<any>;
        }) => import("@impos2/kernel-core-base").Command<{
            target: import("@impos2/kernel-core-base").ScreenPart<any>;
        }>;
        handler: (command: import("@impos2/kernel-core-base").Command<{
            target: import("@impos2/kernel-core-base").ScreenPart<any>;
        }>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    openModal: {
        commandFactory: (value: {
            modal: import("@impos2/kernel-core-base").ScreenPart<any>;
        }) => import("@impos2/kernel-core-base").Command<{
            modal: import("@impos2/kernel-core-base").ScreenPart<any>;
        }>;
        handler: (command: import("@impos2/kernel-core-base").Command<{
            modal: import("@impos2/kernel-core-base").ScreenPart<any>;
        }>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
    closeModal: {
        commandFactory: (value: {
            modalId: string;
        }) => import("@impos2/kernel-core-base").Command<{
            modalId: string;
        }>;
        handler: (command: import("@impos2/kernel-core-base").Command<{
            modalId: string;
        }>) => Promise<Record<string, any>>;
        __isCommandHandler: boolean;
    };
}
//# sourceMappingURL=navigate.d.ts.map