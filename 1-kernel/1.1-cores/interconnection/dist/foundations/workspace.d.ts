import { PayloadAction, Reducer, SliceCaseReducers, ValidateSliceCaseReducers } from "@reduxjs/toolkit";
import { Command, ModuleSliceConfig } from "@impos2/kernel-core-base";
import { Workspace } from "../types/shared/instance";
import { SyncType } from "../types/shared/syncType";
type WorkSpaceValues = `${Workspace}`;
type WorkspaceStateKeys<M extends string, T extends readonly string[]> = {
    [K in T[number]]: `${M}.${K}`;
};
export type CreateModuleWorkspaceStateType<T extends Record<string, any>> = {
    [K in keyof T as `${K & string}.${WorkSpaceValues}`]: T[K];
};
interface WorkspaceSliceResult<State, CR extends SliceCaseReducers<State>, Name extends string> {
    name: Name;
    actions: {
        [K in keyof CR]: CR[K] extends (state: State, action: infer A) => any ? A extends PayloadAction<infer P> ? (payload: P) => PayloadAction<P> : () => PayloadAction<undefined> : never;
    };
    reducers: {
        [W in WorkSpaceValues]: Reducer<State>;
    };
    sliceNames: {
        [W in WorkSpaceValues]: `${Name}.${W}`;
    };
}
/** 支持统一设置(boolean)或按 workspace 分别设置 */
type PerWorkspace<T> = T | Record<WorkSpaceValues, T>;
export interface WorkspaceModuleSliceConfig<State> {
    name: string;
    reducers: Record<WorkSpaceValues, Reducer<State>>;
    persistToStorage: PerWorkspace<boolean>;
    syncType: PerWorkspace<SyncType>;
    persistBlacklist?: PerWorkspace<string[] | undefined>;
}
export declare function createModuleWorkspaceStateKeys<M extends string, T extends readonly string[]>(moduleName: M, keys: T): WorkspaceStateKeys<M, T>;
export declare function createWorkspaceSlice<State, CR extends SliceCaseReducers<State>, Name extends string>(name: Name, initialState: State, reducers: ValidateSliceCaseReducers<State, CR>): WorkspaceSliceResult<State, CR, Name>;
export declare function toModuleSliceConfigs<State>(config: WorkspaceModuleSliceConfig<State>): Record<string, ModuleSliceConfig<State>>;
export declare function dispatchWorkspaceAction(action: PayloadAction<any>, command: Command<any>): void;
export declare function getWorkspaceStateByCommand<State>(baseKey: string, command: Command<any>): State;
export declare function getWorkspaceState<State>(baseKey: string): State;
export {};
//# sourceMappingURL=workspace.d.ts.map