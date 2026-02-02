

export interface UIVariable<T> {
    key: string,
    defaultValue: T
}
const variableSet = new Set<string>()
export function registerUIVariable(variable: UIVariable<any>) {
    if (variableSet.has(variable.key)) {
        throw new Error(`UI variable with key '${variable.key}' is already registered`)
    }
    variableSet.add(variable.key)
    return variable
}