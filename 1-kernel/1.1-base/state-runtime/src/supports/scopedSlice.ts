import {createSlice, type CaseReducerActions, type Reducer, type SliceCaseReducers, type ValidateSliceCaseReducers} from '@reduxjs/toolkit'
import type {PersistIntent, StateRuntimePersistenceDescriptor, SyncIntent} from '../types'
import type {StateRuntimeSliceDescriptor, StateRuntimeSyncDescriptor, StateScopeAxis} from '../types'
import {createScopedStateKey} from './scope'

type ScopedValueConfig<TValue> = TValue | Partial<Record<string, TValue>>

const isScopedValueRecord = <TValue>(
    value: ScopedValueConfig<TValue>,
    scopeValues: readonly string[],
): value is Partial<Record<string, TValue>> => {
    if (typeof value !== 'object' || Array.isArray(value) || value == null) {
        return false
    }
    const keys = Object.keys(value)
    if (keys.length === 0) {
        return false
    }
    return keys.every(key => scopeValues.includes(key))
}

const resolveScopedValue = <TValue>(
    value: ScopedValueConfig<TValue> | undefined,
    scopeValues: readonly string[],
    scopeValue: string,
    fallback: TValue,
): TValue => {
    if (value == null) {
        return fallback
    }
    if (isScopedValueRecord(value, scopeValues)) {
        return (value as Partial<Record<string, TValue>>)[scopeValue] ?? fallback
    }
    return value
}

export interface CreateScopedStateSliceInput<
    State,
    CaseReducers extends SliceCaseReducers<State>,
> {
    baseName: string
    axis: StateScopeAxis
    values: readonly string[]
    initialState: State
    reducers: ValidateSliceCaseReducers<State, CaseReducers>
}

export interface ScopedStateSliceResult<
    State,
    CaseReducers extends SliceCaseReducers<State>,
> {
    name: string
    actions: CaseReducerActions<CaseReducers, string>
    reducers: Record<string, Reducer<State>>
    sliceNames: Record<string, string>
}

export const createScopedStateSlice = <
    State,
    CaseReducers extends SliceCaseReducers<State>,
>(
    input: CreateScopedStateSliceInput<State, CaseReducers>,
): ScopedStateSliceResult<State, CaseReducers> => {
    const referenceSlice = createSlice({
        name: input.baseName,
        initialState: input.initialState,
        reducers: input.reducers,
    })

    const reducers: Record<string, Reducer<State>> = {}
    const sliceNames: Record<string, string> = {}

    for (const value of input.values) {
        const scopedName = createScopedStateKey(input.baseName, {
            axis: input.axis,
            value,
        })
        const scopedSlice = createSlice({
            name: scopedName,
            initialState: input.initialState,
            reducers: input.reducers,
        })

        reducers[value] = scopedSlice.reducer
        sliceNames[value] = scopedName
    }

    return {
        name: input.baseName,
        actions: referenceSlice.actions,
        reducers,
        sliceNames,
    }
}

export const createWorkspaceStateSlice = <
    State,
    CaseReducers extends SliceCaseReducers<State>,
>(
    input: Omit<CreateScopedStateSliceInput<State, CaseReducers>, 'axis'>,
) => createScopedStateSlice({
    ...input,
    axis: 'workspace',
})

export const createInstanceModeStateSlice = <
    State,
    CaseReducers extends SliceCaseReducers<State>,
>(
    input: Omit<CreateScopedStateSliceInput<State, CaseReducers>, 'axis'>,
) => createScopedStateSlice({
    ...input,
    axis: 'instanceMode',
})

export const createDisplayModeStateSlice = <
    State,
    CaseReducers extends SliceCaseReducers<State>,
>(
    input: Omit<CreateScopedStateSliceInput<State, CaseReducers>, 'axis'>,
) => createScopedStateSlice({
    ...input,
    axis: 'displayMode',
})

export interface ScopedSliceDescriptorConfig<State = unknown> {
    name: string
    reducers: Record<string, Reducer<State>>
    persistIntent?: ScopedValueConfig<PersistIntent>
    syncIntent?: ScopedValueConfig<SyncIntent>
    persistence?: ScopedValueConfig<readonly StateRuntimePersistenceDescriptor<State>[] | undefined>
    sync?: ScopedValueConfig<StateRuntimeSyncDescriptor<State> | undefined>
}

export interface ToScopedSliceDescriptorsInput<State = unknown> {
    axis: StateScopeAxis
    values: readonly string[]
    config: ScopedSliceDescriptorConfig<State>
}

export const toScopedSliceDescriptors = <State = unknown>(
    input: ToScopedSliceDescriptorsInput<State>,
): StateRuntimeSliceDescriptor<State>[] => {
    return input.values.map(value => {
        const scopedName = createScopedStateKey(input.config.name, {
            axis: input.axis,
            value,
        })
        return {
            name: scopedName,
            reducer: input.config.reducers[value],
            persistIntent: resolveScopedValue(input.config.persistIntent, input.values, value, 'never'),
            syncIntent: resolveScopedValue(input.config.syncIntent, input.values, value, 'isolated'),
            persistence: resolveScopedValue(input.config.persistence, input.values, value, undefined),
            sync: resolveScopedValue(input.config.sync, input.values, value, undefined),
        } satisfies StateRuntimeSliceDescriptor<State>
    })
}

export const toWorkspaceStateDescriptors = <State = unknown>(
    values: readonly string[],
    config: ScopedSliceDescriptorConfig<State>,
) => toScopedSliceDescriptors({
    axis: 'workspace',
    values,
    config,
})

export const toInstanceModeStateDescriptors = <State = unknown>(
    values: readonly string[],
    config: ScopedSliceDescriptorConfig<State>,
) => toScopedSliceDescriptors({
    axis: 'instanceMode',
    values,
    config,
})

export const toDisplayModeStateDescriptors = <State = unknown>(
    values: readonly string[],
    config: ScopedSliceDescriptorConfig<State>,
) => toScopedSliceDescriptors({
    axis: 'displayMode',
    values,
    config,
})
