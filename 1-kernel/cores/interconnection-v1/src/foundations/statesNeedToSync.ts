import {AppModule, LOG_TAGS, logger, RootState} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../moduleName";
import {SyncType} from "../types/shared/syncType";

export const statesToSyncFromMasterToSlave = new Set<keyof RootState>();
export const statesToSyncFromSlaveToMaster = new Set<keyof RootState>();

export const setStateNeedToSync = (allModules: AppModule[]) => {
    allModules.forEach(module => {
        Object.values(module.slices).forEach(slice => {
            logger.log([moduleName, LOG_TAGS.System, "preSetup"], `read ${slice.name} with sync type ${slice.syncType}`)
            if (!slice.syncType || slice.syncType === SyncType.MASTER_TO_SLAVE)
                statesToSyncFromMasterToSlave.add(slice.name as keyof RootState)
            else if (slice.syncType === SyncType.SLAVE_TO_MASTER)
                statesToSyncFromSlaveToMaster.add(slice.name as keyof RootState)
        })
    })
}