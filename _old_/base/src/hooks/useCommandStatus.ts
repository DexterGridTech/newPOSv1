import {useSelector} from 'react-redux';
import {RequestStatus, RootState} from "../features";
import {createSelector} from '@reduxjs/toolkit';
import {KernelBaseStateNames} from "../types/stateNames";

const selectRequestStatusState = (state: RootState) => {
    return state[KernelBaseStateNames.requestStatus];
};

const selectRequest = (_state: RootState, requestId?: string | null) => requestId;

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
