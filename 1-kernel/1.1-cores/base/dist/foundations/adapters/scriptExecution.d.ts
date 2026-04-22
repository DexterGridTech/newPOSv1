import { Observable } from 'rxjs';
import { ScriptExecutionOptions } from "../../types/foundations/scriptExecution";
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
export declare const scriptsExecution: ScriptsExecution;
export declare function registerScriptsExecution(impl: ScriptsExecution): void;
/**
 * 将 Promise 脚本执行包装为 Observable<ScriptResult>，永不抛出异常
 * args → ScriptExecutionOptions.params，context → ScriptExecutionOptions.globals
 */
export declare function executeScriptAsObservable<T = any>(script: string, args: Record<string, any>, context: Record<string, any>): Observable<ScriptResult<T>>;
/**
 * 将条件脚本执行包装为 Observable<boolean>，永不抛出异常（出错视为 false）
 */
export declare function executeConditionScriptAsObservable(script: string, args: Record<string, any>, context: Record<string, any>): Observable<boolean>;
//# sourceMappingURL=scriptExecution.d.ts.map