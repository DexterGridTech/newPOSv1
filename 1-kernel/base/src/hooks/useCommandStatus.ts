import {useSelector} from 'react-redux';
import {RequestStatus, requestStatusSlice, RootState} from "../features";
import {createSelector} from '@reduxjs/toolkit';

const selectRequestStatusState = (state: RootState) => state[requestStatusSlice.name];
const selectRequest = (_state: RootState, requestId?: string | null) => requestId;

export function useRequestStatus(requestId?: string | null): RequestStatus | null {
    return useSelector((state: RootState) =>
        selectRequestStatus(state, requestId)
    );
}

export const selectRequestStatus = createSelector(
    [selectRequestStatusState, selectRequest],
    (requestStatusState, requestId?): RequestStatus | null => {
        return requestId ? requestStatusState[requestId] : null;
    }
);