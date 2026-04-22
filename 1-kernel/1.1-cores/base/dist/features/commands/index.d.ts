import { ValueWithUpdatedAt } from "../../types";
export declare const kernelCoreBaseCommands: {
    initialize: (payload: void) => import("@impos2/kernel-core-base").Command<void>;
    updateErrorMessages: (payload: Record<string, ValueWithUpdatedAt<string> | null | undefined>) => import("@impos2/kernel-core-base").Command<Record<string, ValueWithUpdatedAt<string> | null | undefined>>;
    updateSystemParameters: (payload: Record<string, ValueWithUpdatedAt<any> | null | undefined>) => import("@impos2/kernel-core-base").Command<Record<string, ValueWithUpdatedAt<any> | null | undefined>>;
    clearDataCache: (payload: void) => import("@impos2/kernel-core-base").Command<void>;
    switchServerSpace: (payload: string) => import("@impos2/kernel-core-base").Command<string>;
};
//# sourceMappingURL=index.d.ts.map