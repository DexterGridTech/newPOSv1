import { InstanceMode } from "../shared/instance";
type InstanceModeValues = `${InstanceMode}`;
type InstanceModeStateKeys<M extends string, T extends readonly string[]> = {
    [K in T[number]]: `${M}.${K}`;
};
export type CreateModuleInstanceModeStateType<T extends Record<string, any>> = {
    [K in keyof T as `${K & string}.${InstanceModeValues}`]: T[K];
};
export declare function createModuleInstanceModeStateKeys<M extends string, T extends readonly string[]>(moduleName: M, keys: T): InstanceModeStateKeys<M, T>;
export {};
//# sourceMappingURL=instanceModeStateKeys.d.ts.map