import {
    kernelCoreBaseState,
    RequestStatus,
    RootState,
    RequestStatusState,
    RequestStatusType,
    IAppError
} from "../types";
import {createSelector} from "@reduxjs/toolkit";
import {useSelector} from 'react-redux';

const selectRequestStatusState = (state: RootState): RequestStatusState => {
    return state[kernelCoreBaseState.requestStatus];
};

const selectRequest = (state: RootState, requestId?: string | null) => requestId;

const toSimpleRequestStatus = (request: RequestStatus): SimpleRequestStatus => {
    let results: Record<string, any> | undefined
    let errors: Record<string, IAppError> | undefined
    for (const cs of Object.values(request.commandsStatus)) {
        if (cs.result) {
            if (!results) results = {}
            Object.assign(results, cs.result)
        }
        if (cs.error) {
            if (!errors) errors = {}
            errors[cs.error.key] = cs.error
        }
    }
    return {
        requestId: request.requestId,
        status: request.status,
        startAt: request.startAt,
        updateAt: request.updateAt,
        results,
        errors
    }
}

const selectRequestStatus = createSelector(
    [selectRequestStatusState, selectRequest],
    (requestStatusState, requestId?): SimpleRequestStatus | null => {
        if (!requestId) return null
        const request = requestStatusState[requestId]
        return request ? toSimpleRequestStatus(request) : null
    }
);

export function useRequestStatus(requestId?: string | null): SimpleRequestStatus | null {
    return useSelector((state: RootState) =>
        selectRequestStatus(state, requestId)
    );
}

export interface SimpleRequestStatus {
    requestId: string
    status: RequestStatusType
    startAt: number
    updateAt: number
    results?: Record<string, any>
    errors?: Record<string, IAppError>
}
