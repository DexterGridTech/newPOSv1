/**
 * 脚本执行错误
 */
export class ScriptExecutionError extends Error {
    script;
    originalError;
    constructor(message, script, originalError) {
        super(message);
        this.script = script;
        this.originalError = originalError;
        this.name = 'ScriptExecutionError';
    }
}
