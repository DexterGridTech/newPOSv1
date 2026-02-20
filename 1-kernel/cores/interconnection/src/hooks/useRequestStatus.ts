import {createSelector} from "@reduxjs/toolkit";
import {useSelector} from "react-redux";
import {IAppError, RootState} from "@impos2/kernel-core-base";
import {InstanceMode} from "../types/shared/instance";
import {kernelCoreInterconnectionInstanceState} from "../types/shared/moduleStateKey";
import {RequestStatusState, RequestStatusType} from "../types/state/requestStatus";

const baseKey = kernelCoreInterconnectionInstanceState.requestStatus

const selectMasterState = (state: RootState): RequestStatusState =>
    state[`${baseKey}.${InstanceMode.MASTER}` as keyof RootState] as any

const selectSlaveState = (state: RootState): RequestStatusState =>
    state[`${baseKey}.${InstanceMode.SLAVE}` as keyof RootState] as any

const selectRequestId = (_: RootState, requestId?: string | null) => requestId

const selectMergedRequestStatus = createSelector(
    [selectMasterState, selectSlaveState, selectRequestId],
    (masterState, slaveState, requestId): SimpleRequestStatus | null => {
        if (!requestId) return null

        const masterRequest = masterState?.[requestId]
        const slaveRequest = slaveState?.[requestId]
        if (!masterRequest && !slaveRequest) return null

        const mergedCommandsStatus = {
            ...masterRequest?.commandsStatus,
            ...slaveRequest?.commandsStatus
        }

        const commandStatuses = Object.values(mergedCommandsStatus)
        const hasError = commandStatuses.some(cs => cs.status === 'error')
        const allComplete = commandStatuses.every(cs => cs.status === 'complete')
        const status: RequestStatusType = hasError ? 'error' : allComplete ? 'complete' : 'started'
        const updateAt = commandStatuses.reduce((latest, cs) => {
            const time = cs.completeAt ?? cs.errorAt ?? 0
            return time > latest ? time : latest
        }, 0)

        let results: Record<string, any> | undefined
        let errors: Record<string, IAppError> | undefined
        for (const cs of commandStatuses) {
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
            requestId,
            status,
            startAt: Math.min(masterRequest?.startAt ?? Infinity, slaveRequest?.startAt ?? Infinity),
            updateAt,
            results,
            errors
        }
    }
)

export function useRequestStatus(requestId?: string | null): SimpleRequestStatus | null {
    return useSelector((state: RootState) => selectMergedRequestStatus(state, requestId))
}

export interface SimpleRequestStatus {
    requestId: string
    status: RequestStatusType
    startAt: number
    updateAt: number
    results?: Record<string, any>
    errors?: Record<string, IAppError>
}
