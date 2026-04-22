import { PayloadAction, Reducer, SliceCaseReducers, ValidateSliceCaseReducers } from "@reduxjs/toolkit";
import { Command, ModuleSliceConfig } from "@impos2/kernel-core-base";
import { InstanceMode } from "../types/shared/instance";
import { SyncType } from "../types/shared/syncType";
export { createModuleInstanceModeStateKeys } from "../types/foundations/instanceModeStateKeys";
export type { CreateModuleInstanceModeStateType } from "../types/foundations/instanceModeStateKeys";
type InstanceModeValues = `${InstanceMode}`;
export interface InstanceModeSliceResult<State, CR extends SliceCaseReducers<State>, Name extends string> {
    name: Name;
    actions: {
        [K in keyof CR]: CR[K] extends (state: State, action: infer A) => any ? A extends PayloadAction<infer P> ? (payload: P) => PayloadAction<P> : () => PayloadAction<undefined> : never;
    };
    reducers: {
        [W in InstanceModeValues]: Reducer<State>;
    };
    sliceNames: {
        [W in InstanceModeValues]: `${Name}.${W}`;
    };
}
/** 支持统一设置(boolean)或按 instanceMode 分别设置 */
type PerInstanceMode<T> = T | Record<InstanceModeValues, T>;
export interface InstanceModeModuleSliceConfig<State> {
    name: string;
    reducers: Record<InstanceModeValues, Reducer<State>>;
    persistToStorage: PerInstanceMode<boolean>;
    syncType: PerInstanceMode<SyncType>;
    persistBlacklist?: PerInstanceMode<string[] | undefined>;
}
export declare function createInstanceModeSlice<State, CR extends SliceCaseReducers<State>, Name extends string>(name: Name, initialState: State, reducers: ValidateSliceCaseReducers<State, CR>): InstanceModeSliceResult<State, CR, Name>;
export declare function toInstanceModeModuleSliceConfigs<State>(config: InstanceModeModuleSliceConfig<State>): Record<string, ModuleSliceConfig<State>>;
export declare function dispatchInstanceModeAction(action: PayloadAction<any>, command: Command<any>): void;
export declare function getInstanceModeStateByCommand<State>(baseKey: string, command: Command<any>): State;
export declare function getInstanceModeState<State>(baseKey: string): State;
//# sourceMappingURL=instanceMode.d.ts.map