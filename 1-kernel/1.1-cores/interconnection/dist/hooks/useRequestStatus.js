import { createSelector } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { InstanceMode } from "../types/shared/instance";
import { kernelCoreInterconnectionInstanceState } from "../types/shared/moduleStateKey";
const baseKey = kernelCoreInterconnectionInstanceState.requestStatus;
const selectMasterState = (state) => state[`${baseKey}.${InstanceMode.MASTER}`];
const selectSlaveState = (state) => state[`${baseKey}.${InstanceMode.SLAVE}`];
const selectRequestId = (_, requestId) => requestId;
export const selectMergedRequestStatus = createSelector([selectMasterState, selectSlaveState, selectRequestId], (masterState, slaveState, requestId) => {
    if (!requestId)
        return null;
    const masterRequest = masterState?.[requestId];
    const slaveRequest = slaveState?.[requestId];
    if (!masterRequest && !slaveRequest)
        return null;
    const mergedCommandsStatus = {
        ...masterRequest?.commandsStatus,
        ...slaveRequest?.commandsStatus
    };
    const commandStatuses = Object.values(mergedCommandsStatus);
    const hasError = commandStatuses.some(cs => cs.status === 'error');
    const allComplete = commandStatuses.every(cs => cs.status === 'complete');
    const status = hasError ? 'error' : allComplete ? 'complete' : 'started';
    const updatedAt = commandStatuses.reduce((latest, cs) => {
        const time = cs.completeAt ?? cs.errorAt ?? 0;
        return time > latest ? time : latest;
    }, 0);
    let results;
    let errors;
    for (const cs of commandStatuses) {
        if (cs.result) {
            if (!results)
                results = {};
            Object.assign(results, cs.result);
        }
        if (cs.error) {
            if (!errors)
                errors = {};
            errors[cs.error.key] = cs.error;
        }
    }
    return {
        requestId,
        status,
        startAt: Math.min(masterRequest?.startAt ?? Infinity, slaveRequest?.startAt ?? Infinity),
        updatedAt,
        results,
        errors
    };
});
export function useRequestStatus(requestId) {
    return useSelector((state) => selectMergedRequestStatus(state, requestId));
}
