import type {StateScopeAxis, StateScopeDescriptor} from '../types'
import type {StateRuntimeSliceDescriptor} from '../types'
import type {UnknownAction} from '@reduxjs/toolkit'

export const createModuleStateKeys = <TModuleName extends string, TKey extends string>(
    moduleName: TModuleName,
    keys: readonly TKey[],
) => {
    return Object.fromEntries(
        keys.map(key => [key, `${moduleName}.${key}`]),
    ) as {[K in TKey]: `${TModuleName}.${K}`}
}

/**
 * 模块级 state key 只负责声明“这一族 slice 的基础命名空间”。
 * 真正按 workspace / instanceMode / displayMode 展开为多份实际 slice，
 * 由 create*StateSlice / to*StateDescriptors 完成。
 */
const createModuleScopedStateKeys = createModuleStateKeys

export const createScopedStateKey = (
    baseKey: string,
    scope: StateScopeDescriptor,
) => `${baseKey}.${scope.value}`

export const createModuleWorkspaceStateKeys = <TModuleName extends string, TKey extends string>(
    moduleName: TModuleName,
    keys: readonly TKey[],
) => createModuleScopedStateKeys(moduleName, keys)

export const createModuleInstanceModeStateKeys = <TModuleName extends string, TKey extends string>(
    moduleName: TModuleName,
    keys: readonly TKey[],
) => createModuleScopedStateKeys(moduleName, keys)

export const createModuleDisplayModeStateKeys = <TModuleName extends string, TKey extends string>(
    moduleName: TModuleName,
    keys: readonly TKey[],
) => createModuleScopedStateKeys(moduleName, keys)

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

const splitActionType = (actionType: string) => {
    const slashIndex = actionType.lastIndexOf('/')
    if (slashIndex === -1) {
        throw new Error(`[createScopedActionType] invalid action type: ${actionType}`)
    }

    return {
        sliceType: actionType.slice(0, slashIndex),
        actionName: actionType.slice(slashIndex),
    }
}

export const createScopedActionType = (
    actionType: string,
    scope: StateScopeDescriptor,
) => {
    const {sliceType, actionName} = splitActionType(actionType)
    return `${createScopedStateKey(sliceType, scope)}${actionName}`
}

export const createScopedDispatchAction = <TAction extends UnknownAction>(
    action: TAction,
    scope: StateScopeDescriptor,
) => ({
    ...action,
    type: createScopedActionType(action.type, scope),
})

interface ScopedActionDispatcherInput {
    dispatch: (action: UnknownAction) => unknown
    routeContext?: Partial<Record<StateScopeAxis, string>>
}

const createAxisActionDispatcher = (
    axis: StateScopeAxis,
    errorFactory: () => string,
    input: ScopedActionDispatcherInput,
) => {
    const value = input.routeContext?.[axis]
    if (!value) {
        throw new Error(errorFactory())
    }

    return <TAction extends UnknownAction>(action: TAction) =>
        input.dispatch(createScopedDispatchAction(action, {
            axis,
            value,
        }))
}

export const createWorkspaceActionDispatcher = (
    input: ScopedActionDispatcherInput,
) => createAxisActionDispatcher(
    'workspace',
    () => '[createWorkspaceActionDispatcher] routeContext.workspace is required',
    input,
)

export const createInstanceModeActionDispatcher = (
    input: ScopedActionDispatcherInput,
) => createAxisActionDispatcher(
    'instanceMode',
    () => '[createInstanceModeActionDispatcher] routeContext.instanceMode is required',
    input,
)

export const createDisplayModeActionDispatcher = (
    input: ScopedActionDispatcherInput,
) => createAxisActionDispatcher(
    'displayMode',
    () => '[createDisplayModeActionDispatcher] routeContext.displayMode is required',
    input,
)
