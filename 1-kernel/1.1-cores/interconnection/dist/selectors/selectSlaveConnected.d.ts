import { RootState } from '@impos2/kernel-core-base';
import { InstanceInfoState } from '../types/state/instanceInfo';
import { InstanceInterconnectionState } from '../types/state/instanceInterconnection';
export declare const selectSlaveConnected: ((state: RootState) => boolean) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: InstanceInfoState | undefined, resultFuncArgs_1: InstanceInterconnectionState | undefined) => boolean;
    memoizedResultFunc: ((resultFuncArgs_0: InstanceInfoState | undefined, resultFuncArgs_1: InstanceInterconnectionState | undefined) => boolean) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => boolean;
    dependencies: [(state: RootState) => InstanceInfoState | undefined, (state: RootState) => InstanceInterconnectionState | undefined];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof import("reselect").weakMapMemoize;
    argsMemoize: typeof import("reselect").weakMapMemoize;
};
//# sourceMappingURL=selectSlaveConnected.d.ts.map