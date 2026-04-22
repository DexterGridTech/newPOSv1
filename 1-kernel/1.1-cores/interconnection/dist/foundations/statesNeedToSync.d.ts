import { AppModule, RootState } from "@impos2/kernel-core-base";
export declare const statesToSyncFromMasterToSlave: Set<keyof RootState>;
export declare const statesToSyncFromSlaveToMaster: Set<keyof RootState>;
export declare const setStateNeedToSync: (allModules: AppModule[]) => void;
//# sourceMappingURL=statesNeedToSync.d.ts.map