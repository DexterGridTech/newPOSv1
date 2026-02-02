import {useSelector} from 'react-redux';
import {requestStatusSlice, RootState} from "../features";
import {createSelector} from '@reduxjs/toolkit';
import {RequestQueryResult, RequestQueryStatus} from "../types";

const selectRequestStatusState = (state: RootState) => state[requestStatusSlice.name];
const selectRequest = (_state: RootState, requestId?: string | null) => requestId;

export function useRequestStatus(requestId?: string | null): RequestQueryResult {
    console.log('useRequestStatus', requestId)
    return useSelector((state: RootState) =>
        selectRequestStatus(state, requestId)
    );
}

export const selectRequestStatus = createSelector(
    [selectRequestStatusState, selectRequest],
    (requestStatusState, requestId?): RequestQueryResult => {
        const request = requestId ? requestStatusState[requestId] : undefined;
        const statuses = request ? Object.values(request) : [];

        // 未找到请求或无状态记录
        if (!requestId || !request || statuses.length === 0) {
            return createRequestQueryResult(requestId ?? 'unknown', 'notFound');
        }

        // 计算最早开始时间
        const startAt = Math.min(...statuses.map(s => s.startAt));

        // 检查错误状态 - 优先级最高
        const errorStatus = statuses.find(s => s.status === 'error');
        if (errorStatus) {
            return createRequestQueryResult(requestId, 'error', {
                errorMessage: errorStatus.errorMessage,
                startAt,
                errorAt: errorStatus.errorAt,
            });
        }

        // 检查是否全部完成
        if (statuses.every(s => s.status === 'complete')) {
            const completeAt = Math.max(...statuses.map(s => s.completeAt ?? 0));
            return createRequestQueryResult(requestId, 'complete', {
                startAt,
                completeAt,
            });
        }

        // 默认返回进行中状态
        return createRequestQueryResult(requestId, 'loading', {startAt});
    }
);

const createRequestQueryResult = (
    requestId: string,
    status: RequestQueryStatus,
    options: {
        errorMessage?: string | null;
        startAt?: number | null;
        completeAt?: number | null;
        errorAt?: number | null;
    } = {}
): RequestQueryResult => ({
    requestId,
    status,
    errorMessage: options.errorMessage ?? null,
    startAt: options.startAt ?? null,
    completeAt: options.completeAt ?? null,
    errorAt: options.errorAt ?? null,
});