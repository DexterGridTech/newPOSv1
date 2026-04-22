import { ErrorMessagesState, ModuleSliceConfig } from "../../types";
export declare const errorMessagesActions: import("@reduxjs/toolkit").CaseReducerActions<{
    batchUpdateState: (state: {
        [x: string]: {
            value: string;
            updatedAt: number;
        };
    }, action: {
        payload: any;
        type: string;
    }) => void;
}, "kernel.core.base.errorMessages">;
export declare const errorMessagesConfig: ModuleSliceConfig<ErrorMessagesState>;
//# sourceMappingURL=errorMessages.d.ts.map