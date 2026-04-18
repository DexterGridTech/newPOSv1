export interface AutomationScriptExecutionInput {
    readonly source: string
    readonly params?: Record<string, unknown>
    readonly globals?: Record<string, unknown>
    readonly timeoutMs?: number
}

export interface AutomationScriptExecutorAdapter {
    execute<T = unknown>(input: AutomationScriptExecutionInput): Promise<T>
}

export const createBrowserScriptExecutorAdapter = (host: {
    execute(
        source: string,
        params?: Record<string, unknown>,
        globals?: Record<string, unknown>,
        timeoutMs?: number,
    ): unknown | Promise<unknown>
}): AutomationScriptExecutorAdapter => ({
    async execute<T = unknown>(input: AutomationScriptExecutionInput): Promise<T> {
        return await host.execute(input.source, input.params, input.globals, input.timeoutMs) as T
    },
})
