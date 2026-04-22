import { ScreenPart } from "@impos2/kernel-core-base";
export declare const kernelCoreNavigationCommands: {
    navigateTo: (payload: {
        target: ScreenPart<any>;
    }) => import("@impos2/kernel-core-base").Command<{
        target: ScreenPart<any>;
    }>;
    openModal: (payload: {
        modal: ScreenPart<any>;
    }) => import("@impos2/kernel-core-base").Command<{
        modal: ScreenPart<any>;
    }>;
    closeModal: (payload: {
        modalId: string;
    }) => import("@impos2/kernel-core-base").Command<{
        modalId: string;
    }>;
    setUiVariables: (payload: Record<string, any>) => import("@impos2/kernel-core-base").Command<Record<string, any>>;
    clearUiVariables: (payload: string[]) => import("@impos2/kernel-core-base").Command<string[]>;
};
//# sourceMappingURL=index.d.ts.map