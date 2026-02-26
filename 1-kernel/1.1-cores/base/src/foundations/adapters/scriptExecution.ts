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
        if (!registeredScriptsExecution) {
            throw new Error('Scripts execution adapter not registered')
        }
        return registeredScriptsExecution.executeScript(options);
    }
}
let registeredScriptsExecution: ScriptsExecution | undefined;

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

