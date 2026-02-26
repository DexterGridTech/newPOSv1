import {NativeEventEmitter} from 'react-native'
import NativeScriptsTurboModule from '../supports/apis/NativeScriptsTurboModule'
import {ScriptsExecution} from '@impos2/kernel-core-base'
import {ScriptExecutionOptions, ScriptExecutionError} from '@impos2/kernel-core-base'

const emitter = new NativeEventEmitter(NativeScriptsTurboModule)

interface NativeCallEvent {
    callId: string
    funcName: string
    argsJson: string
}

export const scriptExecutionAdapter: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const {script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000} = options
        if (!script?.trim()) throw new ScriptExecutionError('Script cannot be empty', script)

        const paramsJson = JSON.stringify(params)
        const globalsJson = JSON.stringify(globals)
        const nativeFuncNames = Object.keys(nativeFunctions)

        // 在发起执行前注册监听，避免竞态丢失事件
        const subscription = emitter.addListener('onNativeCall', async (event: NativeCallEvent) => {
            try {
                const args: any[] = JSON.parse(event.argsJson)
                const fn = nativeFunctions[event.funcName]
                if (!fn) {
                    await NativeScriptsTurboModule.rejectNativeCall(
                        event.callId,
                        `Unknown nativeFunction: ${event.funcName}`,
                    )
                    return
                }
                const result = await fn(...args)
                await NativeScriptsTurboModule.resolveNativeCall(
                    event.callId,
                    JSON.stringify(result ?? null),
                )
            } catch (e: any) {
                await NativeScriptsTurboModule.rejectNativeCall(
                    event.callId,
                    e?.message ?? String(e),
                )
            }
        })

        try {
            const resultJson = await NativeScriptsTurboModule.executeScript(
                script,
                paramsJson,
                globalsJson,
                nativeFuncNames,
                timeout,
            )
            return JSON.parse(resultJson) as T
        } catch (e: any) {
            if (e instanceof ScriptExecutionError) throw e
            throw new ScriptExecutionError(`Script execution failed: ${e?.message}`, script, e)
        } finally {
            subscription.remove()
        }
    },
}
