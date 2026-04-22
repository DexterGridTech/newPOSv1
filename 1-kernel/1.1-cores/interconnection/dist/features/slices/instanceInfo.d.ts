import { ModuleSliceConfig } from "@impos2/kernel-core-base";
import { PayloadAction } from "@reduxjs/toolkit";
import { InstanceInfoState } from "../../types/state/instanceInfo";
import { DisplayMode, InstanceMode, Workspace } from "../../types/shared/instance";
import { MasterInfo } from "../../types";
export declare const instanceInfoActions: import("@reduxjs/toolkit").CaseReducerActions<{
    setInstanceMode: (state: {
        instanceMode: InstanceMode;
        displayMode: DisplayMode;
        workspace: Workspace;
        standalone: boolean;
        enableSlave: boolean;
        masterInfo?: {
            deviceId: string;
            serverAddress: {
                name: string;
                address: string;
            }[];
            addedAt: number;
        } | null | undefined;
    }, action: PayloadAction<InstanceMode>) => void;
    setDisplayMode: (state: {
        instanceMode: InstanceMode;
        displayMode: DisplayMode;
        workspace: Workspace;
        standalone: boolean;
        enableSlave: boolean;
        masterInfo?: {
            deviceId: string;
            serverAddress: {
                name: string;
                address: string;
            }[];
            addedAt: number;
        } | null | undefined;
    }, action: PayloadAction<DisplayMode>) => void;
    enableSlave: (state: {
        instanceMode: InstanceMode;
        displayMode: DisplayMode;
        workspace: Workspace;
        standalone: boolean;
        enableSlave: boolean;
        masterInfo?: {
            deviceId: string;
            serverAddress: {
                name: string;
                address: string;
            }[];
            addedAt: number;
        } | null | undefined;
    }, action: PayloadAction<boolean>) => void;
    setMasterInfo: (state: {
        instanceMode: InstanceMode;
        displayMode: DisplayMode;
        workspace: Workspace;
        standalone: boolean;
        enableSlave: boolean;
        masterInfo?: {
            deviceId: string;
            serverAddress: {
                name: string;
                address: string;
            }[];
            addedAt: number;
        } | null | undefined;
    }, action: PayloadAction<MasterInfo | null>) => void;
}, "kernel.core.interconnection.instanceInfo">;
export declare const instanceInfoConfig: ModuleSliceConfig<InstanceInfoState>;
//# sourceMappingURL=instanceInfo.d.ts.map