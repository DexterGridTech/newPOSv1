import { createSelector } from 'reselect';
import { RootState } from '@impos2/kernel-core-base';
import { kernelCoreInterconnectionState } from '../types/shared/moduleStateKey';
import { InstanceInfoState } from '../types/state/instanceInfo';
import { InstanceInterconnectionState } from '../types/state/instanceInterconnection';
import { InstanceMode } from '../types/shared/instance';

const selectInstanceInfo = (state: RootState): InstanceInfoState | undefined => {
    return state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as InstanceInfoState | undefined;
};

const selectInstanceInterconnection = (state: RootState): InstanceInterconnectionState | undefined => {
    return state[kernelCoreInterconnectionState.instanceInterconnection as keyof RootState] as InstanceInterconnectionState | undefined;
};

export const selectSlaveConnected = createSelector(
    [selectInstanceInfo, selectInstanceInterconnection],
    (instanceInfo, instanceInterconnection) => {
        if (!instanceInfo || !instanceInterconnection) {
            return false;
        }

        const isMaster = instanceInfo.instanceMode === InstanceMode.MASTER;
        const slaveConnected = !instanceInterconnection.master.slaveConnection?.disconnectedAt;

        return isMaster && slaveConnected;
    }
);
