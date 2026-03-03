import {InstanceMode} from "../shared/instance";

type InstanceModeValues = `${InstanceMode}`

type InstanceModeStateKeys<M extends string, T extends readonly string[]> = {
    [K in T[number]]: `${M}.${K}`
}

export type CreateModuleInstanceModeStateType<T extends Record<string, any>> = {
    [K in keyof T as `${K & string}.${InstanceModeValues}`]: T[K]
}

export function createModuleInstanceModeStateKeys<M extends string, T extends readonly string[]>(
    moduleName: M,
    keys: T
): InstanceModeStateKeys<M, T> {
    return keys.reduce((acc, key) => {
        acc[key] = `${moduleName}.${key}`;
        return acc;
    }, {} as any);
}
