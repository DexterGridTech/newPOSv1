import { IAppError, RootState } from "@impos2/kernel-core-base";
import { RequestStatusState, RequestStatusType } from "../types/state/requestStatus";
export declare const selectMergedRequestStatus: ((state: RootState, requestId?: string | null | undefined) => CommandRequestStatus | null) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: RequestStatusState, resultFuncArgs_1: RequestStatusState, resultFuncArgs_2: string | null | undefined) => CommandRequestStatus | null;
    memoizedResultFunc: ((resultFuncArgs_0: RequestStatusState, resultFuncArgs_1: RequestStatusState, resultFuncArgs_2: string | null | undefined) => CommandRequestStatus | null) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => CommandRequestStatus | null;
    dependencies: [(state: RootState) => RequestStatusState, (state: RootState) => RequestStatusState, (_: RootState, requestId?: string | null) => string | null | undefined];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof import("reselect").weakMapMemoize;
    argsMemoize: typeof import("reselect").weakMapMemoize;
};
export declare function useRequestStatus(requestId?: string | null): CommandRequestStatus | null;
export interface CommandRequestStatus {
    requestId: string;
    status: RequestStatusType;
    startAt: number;
    updatedAt: number;
    results?: Record<string, any>;
    errors?: Record<string, IAppError>;
}
//# sourceMappingURL=useRequestStatus.d.ts.map