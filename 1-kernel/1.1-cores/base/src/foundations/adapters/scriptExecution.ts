import {Observable, from, defer, of} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
import {ScriptExecutionOptions, ScriptExecutionError} from "../../types/foundations/scriptExecution";

export interface ScriptResult<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };
}

export interface ScriptsExecution {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T>;
}

export const scriptsExecution: ScriptsExecution = {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        return registeredScriptsExecution.executeScript(options);
    }
}

/**
 * 默认实现：基于 new Function，适用于 Node.js / Web 开发调试环境。
 * Android 适配器加载后会通过 registerScriptsExecution 覆盖此实现。
 *
 * 脚本约定：
 *   - 通过 `params` 访问传入参数
 *   - 通过变量名直接访问 globals
 *   - 通过函数名直接调用 nativeFunctions
 *   - 需显式 return 返回值
 */
let registeredScriptsExecution: ScriptsExecution = {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        const { script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000 } = options;
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new ScriptExecutionError(`Script execution timed out (${timeout}ms)`, script));
                }
            }, timeout);
            try {
                const globalKeys = Object.keys(globals);
                const nativeKeys = Object.keys(nativeFunctions);
                const allKeys = ['params', ...globalKeys, ...nativeKeys];
                const allValues = [params, ...globalKeys.map(k => globals[k]), ...nativeKeys.map(k => nativeFunctions[k])];
                // eslint-disable-next-line no-new-func
                const fn = new Function(...allKeys, script);
                Promise.resolve(fn(...allValues)).then(
                    (val) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val as T); } },
                    (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(new ScriptExecutionError(err?.message ?? String(err), script, err)); } }
                );
            } catch (err: any) {
                if (!settled) { settled = true; clearTimeout(timer); reject(new ScriptExecutionError(err?.message ?? String(err), script, err)); }
            }
        });
    }
};

export function registerScriptsExecution(impl: ScriptsExecution) {
    registeredScriptsExecution = impl;
}

/**
 * 将 Promise 脚本执行包装为 Observable<ScriptResult>，永不抛出异常
 * args → ScriptExecutionOptions.params，context → ScriptExecutionOptions.globals
 */
export function executeScriptAsObservable<T = any>(
    script: string,
    args: Record<string, any>,
    context: Record<string, any>
): Observable<ScriptResult<T>> {
    // defer() 确保同步异常（如 adapter 未注册）也能被 catchError 捕获
    return defer(() =>
        from(scriptsExecution.executeScript<T>({script, params: args, globals: context}))
    ).pipe(
        map(data => ({success: true, data} as ScriptResult<T>)),
        catchError(err => {
            const isScriptError = err instanceof ScriptExecutionError;
            const message = err?.message ?? String(err);
            const originalMessage = isScriptError && err.originalError?.message
                ? ` (caused by: ${err.originalError.message})`
                : '';
            return of<ScriptResult<T>>({
                success: false,
                error: {
                    code: isScriptError ? 'SCRIPT_EXEC_ERROR' : 'ADAPTER_ERROR',
                    message: message + originalMessage,
                    retryable: false,
                },
            });
        })
    );
}

/**
 * 将条件脚本执行包装为 Observable<boolean>，永不抛出异常（出错视为 false）
 */
export function executeConditionScriptAsObservable(
    script: string,
    args: Record<string, any>,
    context: Record<string, any>
): Observable<boolean> {
    return defer(() =>
        from(scriptsExecution.executeScript<boolean>({script, params: args, globals: context}))
    ).pipe(
        map(result => Boolean(result)),
        catchError(() => of(false))
    );
}

