import {RootState} from "@impos2/kernel-core-base";

export const unitDataStateKeys = new Set<keyof RootState>()

export function createUnitDataStateKeys<T extends readonly string[]>(keys: T): { [K in T[number]]: K } {
    const result = {} as { [K in T[number]]: K }
    for (const key of keys) {
        (result as any)[key] = key
        unitDataStateKeys.add(key as keyof RootState)
    }
    return result
}