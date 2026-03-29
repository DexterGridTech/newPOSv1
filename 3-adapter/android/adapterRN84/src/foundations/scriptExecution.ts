import {ScriptsExecution, ScriptExecutionOptions, ScriptExecutionError} from '@impos2/kernel-core-base'

// Stub: NativeScriptsTurboModule 尚未实现，直接执行 JS（无原生沙箱）
export const scriptExecutionAdapter: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const {script, params = {}} = options
        if (!script?.trim()) throw new ScriptExecutionError('Script cannot be empty', script)
        try {
            // stub: 用 Function 简单执行，仅供开发调试
            // eslint-disable-next-line no-new-func
            const fn = new Function('params', `${script}`)
            const result = fn(params)
            return result as T
        } catch (e: any) {
            throw new ScriptExecutionError(`Script execution failed: ${e?.message}`, script, e)
        }
    },
}
