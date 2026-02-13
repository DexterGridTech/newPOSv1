import {kernelCoreBaseState, RequestStatus, RootState} from "../types";
import {createSelector} from "@reduxjs/toolkit";
import {useSelector} from 'react-redux';

const selectRequestStatusState = (state: RootState) => {
    return state[kernelCoreBaseState.requestStatus];
};

const selectRequest = (state: RootState, requestId?: string | null) => requestId;

const selectRequestStatus = createSelector(
    [selectRequestStatusState, selectRequest],
    (requestStatusState, requestId?): RequestStatus | null => {
        return requestId ? requestStatusState[requestId] : null;
    }
);

export function useRequestStatus(requestId?: string | null): RequestStatus | null {
    return useSelector((state: RootState) =>
        selectRequestStatus(state, requestId)
    );
}
