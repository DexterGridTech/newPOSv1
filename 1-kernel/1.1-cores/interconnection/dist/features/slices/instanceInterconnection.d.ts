import { ModuleSliceConfig } from "@impos2/kernel-core-base";
import { PayloadAction } from "@reduxjs/toolkit";
import { InstanceInterconnectionState, ServerConnectionStatus } from "../../types";
export declare const instanceInterconnectionActions: import("@reduxjs/toolkit").CaseReducerActions<{
    connecting: (state: {
        serverConnectionStatus: ServerConnectionStatus;
        startToSync: boolean;
        connectedAt?: number | null | undefined;
        disconnectedAt?: number | null | undefined;
        connectionError?: string | null | undefined;
        connectionHistory: {
            connectedAt: number;
            disconnectedAt: number;
            connectionError: string;
        }[];
        master: {
            slaveConnectionHistory: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            }[];
            slaveConnection?: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            } | undefined;
        };
    }) => void;
    connected: (state: {
        serverConnectionStatus: ServerConnectionStatus;
        startToSync: boolean;
        connectedAt?: number | null | undefined;
        disconnectedAt?: number | null | undefined;
        connectionError?: string | null | undefined;
        connectionHistory: {
            connectedAt: number;
            disconnectedAt: number;
            connectionError: string;
        }[];
        master: {
            slaveConnectionHistory: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            }[];
            slaveConnection?: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            } | undefined;
        };
    }) => void;
    disconnected: (state: {
        serverConnectionStatus: ServerConnectionStatus;
        startToSync: boolean;
        connectedAt?: number | null | undefined;
        disconnectedAt?: number | null | undefined;
        connectionError?: string | null | undefined;
        connectionHistory: {
            connectedAt: number;
            disconnectedAt: number;
            connectionError: string;
        }[];
        master: {
            slaveConnectionHistory: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            }[];
            slaveConnection?: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            } | undefined;
        };
    }, action: PayloadAction<{
        connectionError: string;
    }>) => void;
    startToSync: (state: {
        serverConnectionStatus: ServerConnectionStatus;
        startToSync: boolean;
        connectedAt?: number | null | undefined;
        disconnectedAt?: number | null | undefined;
        connectionError?: string | null | undefined;
        connectionHistory: {
            connectedAt: number;
            disconnectedAt: number;
            connectionError: string;
        }[];
        master: {
            slaveConnectionHistory: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            }[];
            slaveConnection?: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            } | undefined;
        };
    }) => void;
    slaveConnected: (state: {
        serverConnectionStatus: ServerConnectionStatus;
        startToSync: boolean;
        connectedAt?: number | null | undefined;
        disconnectedAt?: number | null | undefined;
        connectionError?: string | null | undefined;
        connectionHistory: {
            connectedAt: number;
            disconnectedAt: number;
            connectionError: string;
        }[];
        master: {
            slaveConnectionHistory: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            }[];
            slaveConnection?: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            } | undefined;
        };
    }, action: PayloadAction<string>) => void;
    slaveDisconnected: (state: {
        serverConnectionStatus: ServerConnectionStatus;
        startToSync: boolean;
        connectedAt?: number | null | undefined;
        disconnectedAt?: number | null | undefined;
        connectionError?: string | null | undefined;
        connectionHistory: {
            connectedAt: number;
            disconnectedAt: number;
            connectionError: string;
        }[];
        master: {
            slaveConnectionHistory: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            }[];
            slaveConnection?: {
                deviceId: string;
                connectedAt: number;
                disconnectedAt?: number | undefined;
            } | undefined;
        };
    }) => void;
}, "kernel.core.interconnection.instanceInterconnection">;
export declare const instanceInterconnectionConfig: ModuleSliceConfig<InstanceInterconnectionState>;
//# sourceMappingURL=instanceInterconnection.d.ts.map