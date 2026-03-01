import {NativeEventEmitter} from 'react-native'
import NativeScriptsTurboModule from '../supports/apis/NativeScriptsTurboModule'
import {ScriptsExecution, ScriptExecutionOptions, ScriptExecutionError} from '@impos2/kernel-core-base'

const emitter = new NativeEventEmitter(NativeScriptsTurboModule)

interface NativeCallEvent {
    callId: string
    funcName: string
    argsJson: string
}

type NativeFunctionsMap = Record<string, (...args: any[]) => any>
const activeExecutions = new Map<string, NativeFunctionsMap>()

emitter.addListener('onNativeCall', async (event: NativeCallEvent) => {
    console.log('[ScriptExecution] onNativeCall received:', event)
    const executionId = event.callId.split(':')[0]
    const nativeFunctions = activeExecutions.get(executionId)
    console.log('[ScriptExecution] executionId:', executionId, 'nativeFunctions:', nativeFunctions ? Object.keys(nativeFunctions) : 'null')
    if (!nativeFunctions) return

    try {
        const args: any[] = JSON.parse(event.argsJson)
        const fn = nativeFunctions[event.funcName]
        if (!fn) {
            console.log('[ScriptExecution] Unknown function:', event.funcName)
            await NativeScriptsTurboModule.rejectNativeCall(event.callId, `Unknown nativeFunction: ${event.funcName}`)
            return
        }
        console.log('[ScriptExecution] Calling function:', event.funcName, 'with args:', args)
        const result = await fn(...args)
        console.log('[ScriptExecution] Function result:', result)
        await NativeScriptsTurboModule.resolveNativeCall(event.callId, JSON.stringify(result ?? null))
    } catch (e: any) {
        console.log('[ScriptExecution] Function error:', e)
        await NativeScriptsTurboModule.rejectNativeCall(event.callId, e?.message ?? String(e))
    }
})

export const scriptExecutionAdapter: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const {script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000} = options
        if (!script?.trim()) throw new ScriptExecutionError('Script cannot be empty', script)

        const executionId = Math.random().toString(36).substring(2, 15)
        console.log('[ScriptExecution] executeScript:', {executionId, nativeFunctions: Object.keys(nativeFunctions)})
        activeExecutions.set(executionId, nativeFunctions)

        try {
            const resultJson = await NativeScriptsTurboModule.executeScript(
                executionId,
                script,
                JSON.stringify(params),
                JSON.stringify(globals),
                Object.keys(nativeFunctions),
                timeout,
            )
            console.log('[ScriptExecution] executeScript success:', resultJson)
            return JSON.parse(resultJson) as T
        } catch (e: any) {
            console.log('[ScriptExecution] executeScript error:', e)
            if (e instanceof ScriptExecutionError) throw e
            throw new ScriptExecutionError(`Script execution failed: ${e?.message}`, script, e)
        } finally {
            activeExecutions.delete(executionId)
        }
    },
}
