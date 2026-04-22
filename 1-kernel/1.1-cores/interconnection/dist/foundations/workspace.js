import { createSlice } from "@reduxjs/toolkit";
import { storeEntry } from "@impos2/kernel-core-base";
import { Workspace } from "../types/shared/instance";
import { getWorkspace } from "./accessory";
// ---- createModuleWorkspaceStateKeys ----
export function createModuleWorkspaceStateKeys(moduleName, keys) {
    return keys.reduce((acc, key) => {
        acc[key] = `${moduleName}.${key}`;
        return acc;
    }, {});
}
// ---- createWorkspaceSlice ----
export function createWorkspaceSlice(name, initialState, reducers) {
    const workspaceValues = Object.values(Workspace);
    const referenceSlice = createSlice({
        name: `${name}.${workspaceValues[0]}`,
        initialState,
        reducers
    });
    const reducerMap = {};
    const sliceNameMap = {};
    for (const ws of workspaceValues) {
        const wsSlice = createSlice({
            name: `${name}.${ws}`,
            initialState,
            reducers
        });
        reducerMap[ws] = wsSlice.reducer;
        sliceNameMap[ws] = `${name}.${ws}`;
    }
    return {
        name,
        actions: referenceSlice.actions,
        reducers: reducerMap,
        sliceNames: sliceNameMap
    };
}
// ---- toModuleSliceConfigs ----
function resolvePerWorkspace(value, ws) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value[ws]
        : value;
}
export function toModuleSliceConfigs(config) {
    const result = {};
    const workspaceValues = Object.values(Workspace);
    for (const ws of workspaceValues) {
        const sliceName = `${config.name}.${ws}`;
        const persistBlacklist = resolvePerWorkspace(config.persistBlacklist ?? undefined, ws);
        result[sliceName] = {
            name: sliceName,
            reducer: config.reducers[ws],
            persistToStorage: resolvePerWorkspace(config.persistToStorage, ws),
            syncType: resolvePerWorkspace(config.syncType, ws),
            ...(persistBlacklist ? { persistBlacklist } : {})
        };
    }
    return result;
}
// ---- dispatchWorkspaceAction ----
export function dispatchWorkspaceAction(action, command) {
    const workspace = command.extra?.workspace;
    if (!workspace) {
        throw new Error(`[dispatchWorkspaceAction] command.extra.workspace 不存在。` +
            `command: ${command.commandName}, id: ${command.id}。` +
            `请确保 command 经过 commandWithWorkspaceConverter 处理。`);
    }
    const originalType = action.type;
    const slashIndex = originalType.lastIndexOf('/');
    if (slashIndex === -1) {
        throw new Error(`[dispatchWorkspaceAction] action.type 格式异常: ${originalType}，缺少 "/" 分隔符`);
    }
    const sliceNamePart = originalType.substring(0, slashIndex);
    const actionNamePart = originalType.substring(slashIndex);
    const lastDotIndex = sliceNamePart.lastIndexOf('.');
    const baseKey = sliceNamePart.substring(0, lastDotIndex);
    const targetType = `${baseKey}.${workspace}${actionNamePart}`;
    storeEntry.dispatchAction({
        ...action,
        type: targetType
    });
}
// ---- getWorkspaceStateByKey ----
export function getWorkspaceStateByCommand(baseKey, command) {
    const workspace = command.extra?.workspace;
    if (!workspace) {
        throw new Error(`[getWorkspaceStateByKey] command.extra.workspace 不存在。` +
            `command: ${command.commandName}, baseKey: ${baseKey}`);
    }
    const fullKey = `${baseKey}.${workspace}`;
    return storeEntry.getStateByKey(fullKey);
}
// ---- getWorkspaceState ----
export function getWorkspaceState(baseKey) {
    const workspace = getWorkspace();
    const fullKey = `${baseKey}.${workspace}`;
    return storeEntry.getStateByKey(fullKey);
}
