import { createSlice } from "@reduxjs/toolkit";
import { storeEntry } from "@impos2/kernel-core-base";
import { InstanceMode } from "../types/shared/instance";
import { getInstanceMode } from "./accessory";
// ---- 已移至 types/foundations/instanceModeStateKeys.ts 以打破循环引用 ----
export { createModuleInstanceModeStateKeys } from "../types/foundations/instanceModeStateKeys";
// ---- createInstanceModeSlice ----
export function createInstanceModeSlice(name, initialState, reducers) {
    const modeValues = Object.values(InstanceMode);
    const referenceSlice = createSlice({
        name: `${name}.${modeValues[0]}`,
        initialState,
        reducers
    });
    const reducerMap = {};
    const sliceNameMap = {};
    for (const mode of modeValues) {
        const modeSlice = createSlice({
            name: `${name}.${mode}`,
            initialState,
            reducers
        });
        reducerMap[mode] = modeSlice.reducer;
        sliceNameMap[mode] = `${name}.${mode}`;
    }
    return {
        name,
        actions: referenceSlice.actions,
        reducers: reducerMap,
        sliceNames: sliceNameMap
    };
}
// ---- toInstanceModeModuleSliceConfigs ----
function resolvePerInstanceMode(value, mode) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value[mode]
        : value;
}
export function toInstanceModeModuleSliceConfigs(config) {
    const result = {};
    const modeValues = Object.values(InstanceMode);
    for (const mode of modeValues) {
        const sliceName = `${config.name}.${mode}`;
        const persistBlacklist = resolvePerInstanceMode(config.persistBlacklist ?? undefined, mode);
        result[sliceName] = {
            name: sliceName,
            reducer: config.reducers[mode],
            persistToStorage: resolvePerInstanceMode(config.persistToStorage, mode),
            syncType: resolvePerInstanceMode(config.syncType, mode),
            ...(persistBlacklist ? { persistBlacklist } : {})
        };
    }
    return result;
}
// ---- dispatchInstanceModeAction ----
export function dispatchInstanceModeAction(action, command) {
    const instanceMode = command.extra?.instanceMode;
    if (!instanceMode) {
        throw new Error(`[dispatchInstanceModeAction] command.extra.instanceMode 不存在。` +
            `command: ${command.commandName}, id: ${command.id}。`);
    }
    const originalType = action.type;
    const slashIndex = originalType.lastIndexOf('/');
    if (slashIndex === -1) {
        throw new Error(`[dispatchInstanceModeAction] action.type 格式异常: ${originalType}，缺少 "/" 分隔符`);
    }
    const sliceNamePart = originalType.substring(0, slashIndex);
    const actionNamePart = originalType.substring(slashIndex);
    const lastDotIndex = sliceNamePart.lastIndexOf('.');
    const baseKey = sliceNamePart.substring(0, lastDotIndex);
    const targetType = `${baseKey}.${instanceMode}${actionNamePart}`;
    storeEntry.dispatchAction({
        ...action,
        type: targetType
    });
}
// ---- getInstanceModeStateByCommand ----
export function getInstanceModeStateByCommand(baseKey, command) {
    const instanceMode = command.extra?.instanceMode;
    if (!instanceMode) {
        throw new Error(`[getInstanceModeStateByCommand] command.extra.instanceMode 不存在。` +
            `command: ${command.commandName}, baseKey: ${baseKey}`);
    }
    const fullKey = `${baseKey}.${instanceMode}`;
    return storeEntry.getStateByKey(fullKey);
}
// ---- getInstanceModeState ----
export function getInstanceModeState(baseKey) {
    const instanceMode = getInstanceMode();
    const fullKey = `${baseKey}.${instanceMode}`;
    return storeEntry.getStateByKey(fullKey);
}
