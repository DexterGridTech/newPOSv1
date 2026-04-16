import {NativeEventEmitter} from 'react-native'
import NativeScriptsTurboModule from './specs/NativeScriptsTurboModule'

type NativeCallEvent = {
    callId: string
    funcName: string
    argsJson: string
}

type NativeScriptResult = {
    success?: boolean
    resultJson?: string
    error?: string | null
}

const emitter = new NativeEventEmitter(NativeScriptsTurboModule as any)

let nativeFunctionQueue: Promise<void> = Promise.resolve()

const runExclusive = async <T,>(work: () => Promise<T>): Promise<T> => {
    const previous = nativeFunctionQueue
    let release!: () => void
    nativeFunctionQueue = new Promise<void>(resolve => {
        release = resolve
    })
    await previous
    try {
        return await work()
    } finally {
        release()
    }
}

export const nativeScriptExecutor = {
    async execute<T = unknown>(input: {
        source: string
        params?: Record<string, unknown>
        globals?: Record<string, unknown>
        timeoutMs?: number
    }): Promise<T> {
        const execute = async () => {
            const subscription = emitter.addListener('onNativeCall', async (event: NativeCallEvent) => {
                await NativeScriptsTurboModule.rejectNativeCall(
                    event.callId,
                    `native function is not registered in assembly: ${event.funcName}`,
                )
            })
            try {
                const result = await NativeScriptsTurboModule.executeScript(
                    input.source,
                    JSON.stringify(input.params ?? {}),
                    JSON.stringify(input.globals ?? {}),
                    [],
                    input.timeoutMs ?? 5_000,
                ) as NativeScriptResult
                if (result.success === false) {
                    throw new Error(result.error ?? 'Native script execution failed')
                }
                return JSON.parse(result.resultJson ?? 'null') as T
            } finally {
                subscription.remove()
            }
        }
        return await runExclusive(execute)
    },
}
