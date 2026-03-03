import { ScriptsExecution, ScriptExecutionOptions, ScriptExecutionError } from '@impos2/kernel-core-base'

export const scriptExecutionAdapter: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const { script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000 } = options
        if (!script?.trim()) throw new ScriptExecutionError('Script cannot be empty', script)

        const nativeFuncNames = Object.keys(nativeFunctions)

        const result = await window.electronBridge.invoke('script:execute', {
            script,
            paramsJson: JSON.stringify(params),
            globalsJson: JSON.stringify(globals),
            nativeFuncNames,
            timeout,
        })

        return JSON.parse(result) as T
    },
}
