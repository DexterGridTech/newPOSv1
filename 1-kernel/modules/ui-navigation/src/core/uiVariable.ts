import { DisplayMode, InstanceMode } from "@impos2/kernel-base";

export interface UIVariable<T> {
    key: string,
    defaultValue: T
}

/**
 * 生成 UI 变量的完整键名
 * 格式: {key}@{instanceMode}.{displayMode}
 *
 * @param key - UI 变量的基础键名
 * @param instanceMode - 实例模式 (master/slave)
 * @param displayMode - 显示模式 (primary/secondary)
 * @returns 完整的 UI 变量键名
 *
 * @example
 * generateUiVariableKey('screen.container.root', 'master', 'primary')
 * // 返回: 'screen.container.root@master.primary'
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