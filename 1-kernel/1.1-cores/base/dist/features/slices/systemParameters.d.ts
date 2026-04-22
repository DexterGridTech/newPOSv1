import { ModuleSliceConfig, SystemParametersState } from "../../types";
export declare const systemParametersActions: import("@reduxjs/toolkit").CaseReducerActions<{
    batchUpdateState: (state: {
        [x: string]: {
            value: any;
            updatedAt: number;
        };
    }, action: {
        payload: any;
        type: string;
    }) => void;
}, "kernel.core.base.systemParameters">;
export declare const systemParametersConfig: ModuleSliceConfig<SystemParametersState>;
//# sourceMappingURL=systemParameters.d.ts.map