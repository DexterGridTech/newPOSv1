import {RootState} from "@impos2/kernel-core-base-v1";

export const statesToSyncFromMasterToSlave = new Set<keyof RootState>();
export const statesToSyncFromSlaveToMaster = new Set<keyof RootState>();