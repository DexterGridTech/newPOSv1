import {AppModule, InitLogger, RootState} from "@impos2/kernel-core-base-v1";
import {SyncType} from "../types/shared/syncType";

export const statesToSyncFromMasterToSlave = new Set<keyof RootState>();
export const statesToSyncFromSlaveToMaster = new Set<keyof RootState>();

export const setStateNeedToSync = (allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    const isolated: string[] = []

    allModules.forEach(module => {
        Object.values(module.slices).forEach(slice => {
            if (slice.syncType === SyncType.ISOLATED) {
                isolated.push(slice.name)
            } else if (slice.syncType === SyncType.SLAVE_TO_MASTER) {
                statesToSyncFromSlaveToMaster.add(slice.name as keyof RootState)
            } else {
                statesToSyncFromMasterToSlave.add(slice.name as keyof RootState)
            }
        })
    })

    initLogger.logDetail('Slice Sync Type: Master → Slave', statesToSyncFromMasterToSlave.size.toString())
    initLogger.logNames([...statesToSyncFromMasterToSlave] as string[])
    initLogger.logDetail('Slice Sync Type: Slave → Master', statesToSyncFromSlaveToMaster.size.toString())
    initLogger.logNames([...statesToSyncFromSlaveToMaster] as string[])
    initLogger.logDetail('Slice Sync Type: Isolated', isolated.length.toString())
    initLogger.logNames(isolated)
}