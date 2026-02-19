import {createSlice, PayloadAction, Reducer, SliceCaseReducers, ValidateSliceCaseReducers} from "@reduxjs/toolkit";
import {Command, ModuleSliceConfig, storeEntry} from "@impos2/kernel-core-base-v1";
import {InstanceMode} from "../types/shared/instance";
import {getInstanceMode} from "./accessory";
import {SyncType} from "../types/shared/syncType";

// ---- 已移至 types/foundations/instanceModeStateKeys.ts 以打破循环引用 ----
export {createModuleInstanceModeStateKeys} from "../types/foundations/instanceModeStateKeys";
export type {CreateModuleInstanceModeStateType} from "../types/foundations/instanceModeStateKeys";

// ---- 类型定义 ----

type InstanceModeValues = `${InstanceMode}`

export interface InstanceModeSliceResult<
    State,
    CR extends SliceCaseReducers<State>,
    Name extends string
> {
    name: Name
    actions: {
        [K in keyof CR]: CR[K] extends (state: State, action: infer A) => any
            ? A extends PayloadAction<infer P>
                ? (payload: P) => PayloadAction<P>
                : () => PayloadAction<undefined>
            : never
    }
    reducers: {
        [W in InstanceModeValues]: Reducer<State>
    }
    sliceNames: {
        [W in InstanceModeValues]: `${Name}.${W}`
    }
}

/** 支持统一设置(boolean)或按 instanceMode 分别设置 */
type PerInstanceMode<T> = T | Record<InstanceModeValues, T>

export interface InstanceModeModuleSliceConfig<State> {
    name: string
    reducers: Record<InstanceModeValues, Reducer<State>>
    persistToStorage: PerInstanceMode<boolean>
    syncType: PerInstanceMode<SyncType>
    persistBlacklist?: PerInstanceMode<string[] | undefined>
}

// ---- createInstanceModeSlice ----

export function createInstanceModeSlice<
    State,
    CR extends SliceCaseReducers<State>,
    Name extends string
>(
    name: Name,
    initialState: State,
    reducers: ValidateSliceCaseReducers<State, CR>
): InstanceModeSliceResult<State, CR, Name> {
    const modeValues = Object.values(InstanceMode) as InstanceModeValues[]

    const referenceSlice = createSlice({
        name: `${name}.${modeValues[0]}`,
        initialState,
        reducers
    })

    const reducerMap = {} as Record<InstanceModeValues, Reducer<State>>
    const sliceNameMap = {} as Record<InstanceModeValues, string>

    for (const mode of modeValues) {
        const modeSlice = createSlice({
            name: `${name}.${mode}`,
            initialState,
            reducers
        })
        reducerMap[mode] = modeSlice.reducer
        sliceNameMap[mode] = `${name}.${mode}`
    }

    return {
        name,
        actions: referenceSlice.actions as any,
        reducers: reducerMap,
        sliceNames: sliceNameMap as any
    }
}

// ---- toInstanceModeModuleSliceConfigs ----

function resolvePerInstanceMode<T>(value: PerInstanceMode<T>, mode: InstanceModeValues): T {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<InstanceModeValues, T>)[mode]
        : value as T
}

export function toInstanceModeModuleSliceConfigs<State>(
    config: InstanceModeModuleSliceConfig<State>
): Record<string, ModuleSliceConfig<State>> {
    const result: Record<string, ModuleSliceConfig<State>> = {}
    const modeValues = Object.values(InstanceMode) as InstanceModeValues[]

    for (const mode of modeValues) {
        const sliceName = `${config.name}.${mode}`
        const persistBlacklist = resolvePerInstanceMode(config.persistBlacklist ?? undefined, mode)
        result[sliceName] = {
            name: sliceName,
            reducer: config.reducers[mode],
            persistToStorage: resolvePerInstanceMode(config.persistToStorage, mode),
            syncType: resolvePerInstanceMode(config.syncType, mode),
            ...(persistBlacklist ? {persistBlacklist} : {})
        }
    }
    return result
}

// ---- dispatchInstanceModeAction ----

export function dispatchInstanceModeAction(
    action: PayloadAction<any>,
    command: Command<any>
): void {
    const instanceMode = command.extra?.instanceMode as InstanceMode | undefined
    if (!instanceMode) {
        throw new Error(
            `[dispatchInstanceModeAction] command.extra.instanceMode 不存在。` +
            `command: ${command.commandName}, id: ${command.id}。`
        )
    }

    const originalType = action.type
    const slashIndex = originalType.lastIndexOf('/')
    if (slashIndex === -1) {
        throw new Error(
            `[dispatchInstanceModeAction] action.type 格式异常: ${originalType}，缺少 "/" 分隔符`
        )
    }

    const sliceNamePart = originalType.substring(0, slashIndex)
    const actionNamePart = originalType.substring(slashIndex)
    const lastDotIndex = sliceNamePart.lastIndexOf('.')
    const baseKey = sliceNamePart.substring(0, lastDotIndex)
    const targetType = `${baseKey}.${instanceMode}${actionNamePart}`

    storeEntry.dispatchAction({
        ...action,
        type: targetType
    })
}

// ---- getInstanceModeStateByCommand ----

export function getInstanceModeStateByCommand<State>(
    baseKey: string,
    command: Command<any>
): State {
    const instanceMode = command.extra?.instanceMode as InstanceMode | undefined
    if (!instanceMode) {
        throw new Error(
            `[getInstanceModeStateByCommand] command.extra.instanceMode 不存在。` +
            `command: ${command.commandName}, baseKey: ${baseKey}`
        )
    }
    const fullKey = `${baseKey}.${instanceMode}`
    return storeEntry.getStateByKey(fullKey as any) as State
}

// ---- getInstanceModeState ----

export function getInstanceModeState<State>(baseKey: string): State {
    const instanceMode = getInstanceMode()
    const fullKey = `${baseKey}.${instanceMode}`
    return storeEntry.getStateByKey(fullKey as any) as State
}
