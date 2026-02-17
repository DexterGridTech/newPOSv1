import {createSlice, PayloadAction, Reducer, SliceCaseReducers, ValidateSliceCaseReducers} from "@reduxjs/toolkit";
import {Command, ModuleSliceConfig, storeEntry} from "@impos2/kernel-core-base";
import {WorkSpace} from "../types/shared/instance";
import {getWorkspace} from "./accessory";

// ---- 类型定义 ----

type WorkSpaceValues = `${WorkSpace}`

type WorkspaceStateKeys<M extends string, T extends readonly string[]> = {
    [K in T[number]]: `${M}.${K}`
}

export type CreateModuleWorkspaceStateType<T extends Record<string, any>> = {
    [K in keyof T as `${K & string}.${WorkSpaceValues}`]: T[K]
}

interface WorkspaceSliceResult<
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
        [W in WorkSpaceValues]: Reducer<State>
    }
    sliceNames: {
        [W in WorkSpaceValues]: `${Name}.${W}`
    }
}

export interface WorkspaceModuleSliceConfig<State> {
    name: string
    reducers: Record<WorkSpaceValues, Reducer<State>>
    statePersistToStorage: boolean
    stateSyncToSlave: boolean
    persistBlacklist?: string[]
}

// ---- createModuleWorkspaceStateKeys ----

export function createModuleWorkspaceStateKeys<M extends string, T extends readonly string[]>(
    moduleName: M,
    keys: T
): WorkspaceStateKeys<M, T> {
    return keys.reduce((acc, key) => {
        acc[key] = `${moduleName}.${key}`;
        return acc;
    }, {} as any);
}

// ---- createWorkspaceSlice ----

export function createWorkspaceSlice<
    State,
    CR extends SliceCaseReducers<State>,
    Name extends string
>(
    name: Name,
    initialState: State,
    reducers: ValidateSliceCaseReducers<State, CR>
): WorkspaceSliceResult<State, CR, Name> {
    const workspaceValues = Object.values(WorkSpace) as WorkSpaceValues[]

    const referenceSlice = createSlice({
        name: `${name}.${workspaceValues[0]}`,
        initialState,
        reducers
    })

    const reducerMap = {} as Record<WorkSpaceValues, Reducer<State>>
    const sliceNameMap = {} as Record<WorkSpaceValues, string>

    for (const ws of workspaceValues) {
        const wsSlice = createSlice({
            name: `${name}.${ws}`,
            initialState,
            reducers
        })
        reducerMap[ws] = wsSlice.reducer
        sliceNameMap[ws] = `${name}.${ws}`
    }

    return {
        name,
        actions: referenceSlice.actions as any,
        reducers: reducerMap,
        sliceNames: sliceNameMap as any
    }
}

// ---- toModuleSliceConfigs ----

export function toModuleSliceConfigs<State>(
    config: WorkspaceModuleSliceConfig<State>
): Record<string, ModuleSliceConfig<State>> {
    const result: Record<string, ModuleSliceConfig<State>> = {}
    const workspaceValues = Object.values(WorkSpace) as WorkSpaceValues[]

    for (const ws of workspaceValues) {
        const sliceName = `${config.name}.${ws}`
        result[sliceName] = {
            name: sliceName,
            reducer: config.reducers[ws],
            statePersistToStorage: config.statePersistToStorage,
            stateSyncToSlave: config.stateSyncToSlave,
            persistBlacklist: config.persistBlacklist
        }
    }
    return result
}

// ---- dispatchWorkspaceAction ----

export function dispatchWorkspaceAction(
    action: PayloadAction<any>,
    command: Command<any>
): void {
    const workspace = command.extra?.workspace as WorkSpace | undefined
    if (!workspace) {
        throw new Error(
            `[dispatchWorkspaceAction] command.extra.workspace 不存在。` +
            `command: ${command.commandName}, id: ${command.id}。` +
            `请确保 command 经过 commandWithWorkspaceConverter 处理。`
        )
    }

    const originalType = action.type
    const slashIndex = originalType.lastIndexOf('/')
    if (slashIndex === -1) {
        throw new Error(
            `[dispatchWorkspaceAction] action.type 格式异常: ${originalType}，缺少 "/" 分隔符`
        )
    }

    const sliceNamePart = originalType.substring(0, slashIndex)
    const actionNamePart = originalType.substring(slashIndex)
    const lastDotIndex = sliceNamePart.lastIndexOf('.')
    const baseKey = sliceNamePart.substring(0, lastDotIndex)
    const targetType = `${baseKey}.${workspace}${actionNamePart}`

    storeEntry.dispatchAction({
        ...action,
        type: targetType
    })
}

// ---- getWorkspaceStateByKey ----

export function getWorkspaceStateByKey<State>(
    baseKey: string,
    command: Command<any>
): State {
    const workspace = command.extra?.workspace as WorkSpace | undefined
    if (!workspace) {
        throw new Error(
            `[getWorkspaceStateByKey] command.extra.workspace 不存在。` +
            `command: ${command.commandName}, baseKey: ${baseKey}`
        )
    }
    const fullKey = `${baseKey}.${workspace}`
    return storeEntry.getStateByKey(fullKey as any) as State
}

// ---- getWorkspaceState ----

export function getWorkspaceState<State>(baseKey: string): State {
    const workspace = getWorkspace()
    const fullKey = `${baseKey}.${workspace}`
    return storeEntry.getStateByKey(fullKey as any) as State
}
