import type {StateScopeAxis, StateScopeDescriptor} from '../types'
import type {StateRuntimeSliceDescriptor} from '../types'

export const createScopedStateKey = (
    baseKey: string,
    scope: StateScopeDescriptor,
) => `${baseKey}.${scope.value}`

export const createScopedStatePath = (
    baseKey: string,
    scopes: readonly StateScopeDescriptor[],
) => scopes.reduce((current, scope) => createScopedStateKey(current, scope), baseKey)

export const createScopedStateKeys = <TKey extends string>(
    baseKey: string,
    axis: StateScopeAxis,
    values: readonly TKey[],
) => {
    return Object.fromEntries(
        values.map(value => [value, createScopedStateKey(baseKey, {
            axis,
            value,
        })]),
    ) as Record<TKey, string>
}

export const createWorkspaceStateKeys = <TKey extends string>(
    baseKey: string,
    values: readonly TKey[],
) => createScopedStateKeys(baseKey, 'workspace', values)

export const createInstanceModeStateKeys = <TKey extends string>(
    baseKey: string,
    values: readonly TKey[],
) => createScopedStateKeys(baseKey, 'instanceMode', values)

export const createDisplayModeStateKeys = <TKey extends string>(
    baseKey: string,
    values: readonly TKey[],
) => createScopedStateKeys(baseKey, 'displayMode', values)

export interface ScopedStateSliceDescriptorInput<State = unknown> {
    baseName: string
    axis: StateScopeAxis
    values: readonly string[]
    createDescriptor: (value: string, scopedName: string) => StateRuntimeSliceDescriptor<State>
}

export const createScopedStateDescriptors = <State = unknown>(
    input: ScopedStateSliceDescriptorInput<State>,
) => {
    return input.values.map(value =>
        input.createDescriptor(
            value,
            createScopedStateKey(input.baseName, {
                axis: input.axis,
                value,
            }),
        ),
    )
}

export const getScopedStateKey = (
    baseKey: string,
    scopes: readonly StateScopeDescriptor[],
) => createScopedStatePath(baseKey, scopes)
