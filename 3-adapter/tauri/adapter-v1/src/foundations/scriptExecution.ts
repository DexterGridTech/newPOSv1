import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ScriptsExecution, ScriptExecutionOptions, ScriptExecutionError } from '@impos2/kernel-core-base'

interface NativeCallEvent {
    callId: string
    funcName: string
    argsJson: string
}

export const scriptExecutionAdapter: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const { script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000 } = options
        if (!script?.trim()) throw new ScriptExecutionError('Script cannot be empty', script)

        const nativeFuncNames = Object.keys(nativeFunctions)

        // 在发起执行前注册监听，避免竞态丢失事件
        const unlisten = await listen<NativeCallEvent>('script://native-call', async (event) => {
            const { callId, funcName, argsJson } = event.payload
            try {
                const args: any[] = JSON.parse(argsJson)
                const fn = nativeFunctions[funcName]
                if (!fn) {
                    await invoke('script_reject_native_call', {
                        callId,
                        errorMessage: `Unknown nativeFunction: ${funcName}`,
                    })
                    return
                }
                const result = await fn(...args)
                await invoke('script_resolve_native_call', {
                    callId,
                    resultJson: JSON.stringify(result ?? null),
                })
            } catch (e: any) {
                await invoke('script_reject_native_call', {
                    callId,
                    errorMessage: e?.message ?? String(e),
                })
            }
        })

        try {
            const resultJson = await invoke<string>('script_execute', {
                script,
                paramsJson: JSON.stringify(params),
                globalsJson: JSON.stringify(globals),
                nativeFuncNames,
                timeout,
            })
            return JSON.parse(resultJson) as T
        } catch (e: any) {
            if (e instanceof ScriptExecutionError) throw e
            throw new ScriptExecutionError(`Script execution failed: ${e?.message}`, script, e)
        } finally {
            unlisten()
        }
    },
}
