import { ModuleSliceConfig } from "@impos2/kernel-core-base";
import { PayloadAction } from "@reduxjs/toolkit";
import { DisplayMode, Workspace } from "../../types/shared/instance";
import { SlaveStatusState } from "../../types/state/slaveStatus";
export declare const slaveStatusActions: import("@reduxjs/toolkit").CaseReducerActions<{
    setDisplayMode: (state: {
        displayMode?: {
            value: DisplayMode | null;
            updatedAt: number;
        } | undefined;
        workspace?: {
            value: Workspace | null;
            updatedAt: number;
        } | undefined;
    }, action: PayloadAction<DisplayMode>) => void;
    setWorkspace: (state: {
        displayMode?: {
            value: DisplayMode | null;
            updatedAt: number;
        } | undefined;
        workspace?: {
            value: Workspace | null;
            updatedAt: number;
        } | undefined;
    }, action: PayloadAction<Workspace>) => void;
    batchUpdateState: (state: {
        displayMode?: {
            value: DisplayMode | null;
            updatedAt: number;
        } | undefined;
        workspace?: {
            value: Workspace | null;
            updatedAt: number;
        } | undefined;
    }, action: {
        payload: any;
        type: string;
    }) => void;
}, "kernel.core.interconnection.slaveStatus">;
export declare const slaveStatusConfig: ModuleSliceConfig<SlaveStatusState>;
//# sourceMappingURL=slaveStatus.d.ts.map