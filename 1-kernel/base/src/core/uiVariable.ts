import { DisplayMode, InstanceMode } from "../types";

export interface UIVariable<T> {
    key: string,
    defaultValue: T
}

/**
 * 生成 UI 变量的完整键名
 * 格式: {key}@{instanceMode}.{displayMode}
 */
export function generateUiVariableKey(
    key: string,
    instanceMode: InstanceMode,
    displayMode: DisplayMode
): string {
    return `${key}@${instanceMode}.${displayMode}`;
}
const variableSet = new Set<string>()
export function registerUIVariable(variable: UIVariable<any>) {
    if (variableSet.has(variable.key)) {
        throw new Error(`UI variable with key '${variable.key}' is already registered`)
    }
    variableSet.add(variable.key)
    return variable
}