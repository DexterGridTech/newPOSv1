import {NativeModules} from 'react-native'
import {ScriptsExecution} from '@impos2/kernel-core-base'
import {ScriptExecutionOptions, ScriptExecutionError} from '@impos2/kernel-core-base'

const {ScriptsTurboModule} = NativeModules

export const scriptExecutionAdapter: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const {script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000} = options
        if (!script?.trim()) throw new ScriptExecutionError('Script cannot be empty', script)

        const startTime = Date.now()
        try {
            const result = await executeWithTimeout<T>(script, params, globals, nativeFunctions, timeout)
            const executionTime = Date.now() - startTime
            ScriptsTurboModule.logExecution(script, executionTime, true, '')
            return result
        } catch (e: any) {
            const executionTime = Date.now() - startTime
            ScriptsTurboModule.logExecution(script, executionTime, false, e?.message ?? String(e))
            if (e instanceof ScriptExecutionError) throw e
            throw new ScriptExecutionError(`Script execution failed: ${e?.message}`, script, e)
        }
    },
}

function executeWithTimeout<T>(
    script: string,
    params: Record<string, any>,
    globals: Record<string, any>,
    nativeFunctions: Record<string, (...args: any[]) => any>,
    timeout: number,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new ScriptExecutionError(`Script timeout after ${timeout}ms`, script)), timeout)
        try {
            const paramNames = ['params', ...Object.keys(globals), ...Object.keys(nativeFunctions)]
            const paramValues = [params, ...Object.values(globals), ...Object.values(nativeFunctions)]
            // eslint-disable-next-line no-new-func
            const fn = new Function(...paramNames, script)
            Promise.resolve(fn(...paramValues))
                .then(r => { clearTimeout(timer); resolve(r as T) })
                .catch(e => { clearTimeout(timer); reject(e) })
        } catch (e) {
            clearTimeout(timer)
            reject(e)
        }
    })
}
