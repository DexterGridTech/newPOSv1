import { createSelector } from 'reselect';
import { kernelCoreInterconnectionState } from '../types/shared/moduleStateKey';
import { InstanceMode } from '../types/shared/instance';
const selectInstanceInfo = (state) => {
    return state[kernelCoreInterconnectionState.instanceInfo];
};
const selectInstanceInterconnection = (state) => {
    return state[kernelCoreInterconnectionState.instanceInterconnection];
};
export const selectSlaveConnected = createSelector([selectInstanceInfo, selectInstanceInterconnection], (instanceInfo, instanceInterconnection) => {
    if (!instanceInfo || !instanceInterconnection) {
        return false;
    }
    const isMaster = instanceInfo.instanceMode === InstanceMode.MASTER;
    const slaveConnected = !instanceInterconnection.master.slaveConnection?.disconnectedAt;
    return isMaster && slaveConnected;
});
