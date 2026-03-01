import {ScriptsExecution, ScriptExecutionOptions, ScriptExecutionError} from '@mono/kernel-core-base'
import NativeScriptsTurboModule from '../specs/NativeScriptsTurboModule'

export const scriptExecution: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const {script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000} = options

        // Validate inputs
        if (!script || typeof script !== 'string') {
            throw new ScriptExecutionError(
                'Script must be a non-empty string',
                script || ''
            )
        }

        // Serialize parameters
        const paramsJson = JSON.stringify(params)
        const globalsJson = JSON.stringify(globals)
        const nativeFuncNames = Object.keys(nativeFunctions)

        try {
            // Call native module
            const resultJson = await NativeScriptsTurboModule.executeScript(
                script,
                paramsJson,
                globalsJson,
                nativeFuncNames,
                timeout
            )

            // Parse result
            const result = JSON.parse(resultJson)

            if (result.success) {
                return result.result as T
            } else {
                throw new ScriptExecutionError(
                    result.message || 'Script execution failed',
                    script,
                    result.stack ? new Error(result.stack) : undefined
                )
            }
        } catch (error) {
            if (error instanceof ScriptExecutionError) {
                throw error
            }
            throw new ScriptExecutionError(
                error instanceof Error ? error.message : 'Unknown error',
                script,
                error
            )
        }
    }
}

export async function getExecutionStats() {
    const stats = await NativeScriptsTurboModule.getStats()
    return {
        totalExecutions: stats.totalExecutions,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        cacheHitRate: stats.cacheHitRate
    }
}

export async function clearCache() {
    await NativeScriptsTurboModule.clearCache()
}
