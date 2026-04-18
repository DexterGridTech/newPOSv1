import type {AutomationMethod} from '../types/protocol'

export interface AutomationJsonRpcDispatcher {
    dispatchMessage(messageJson: string): Promise<string>
}

export interface AutomationJsonRpcClient {
    call<TResult = unknown>(
        method: AutomationMethod,
        params?: Record<string, unknown>,
    ): Promise<TResult>
}

export const createAutomationJsonRpcClient = (
    dispatcher: AutomationJsonRpcDispatcher,
): AutomationJsonRpcClient => {
    let nextId = 1

    return {
        async call<TResult = unknown>(
            method: AutomationMethod,
            params: Record<string, unknown> = {},
        ): Promise<TResult> {
            const id = nextId++
            const responseJson = await dispatcher.dispatchMessage(JSON.stringify({
                jsonrpc: '2.0',
                id,
                method,
                params,
            }))
            const response = JSON.parse(responseJson) as {
                readonly id?: number
                readonly result?: TResult
                readonly error?: {
                    readonly code: number
                    readonly message: string
                    readonly data?: unknown
                }
            }
            if (response.error) {
                const error = new Error(response.error.message)
                ;(error as Error & {code?: number; data?: unknown}).code = response.error.code
                ;(error as Error & {code?: number; data?: unknown}).data = response.error.data
                throw error
            }
            return response.result as TResult
        },
    }
}
