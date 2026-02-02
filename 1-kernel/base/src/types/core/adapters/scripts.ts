export interface ScriptExecutionOptions<T = any> {
    /**
     * 要执行的 JavaScript 代码
     */
    script: string;

    /**
     * 传递给脚本的参数对象，在脚本中通过 params 访问
     */
    params?: Record<string, any>;

    /**
     * 设置的全局变量，在脚本中直接访问
     */
    globals?: Record<string, any>;

    /**
     * 注册的原生函数，在脚本中可以调用
     */
    nativeFunctions?: Record<string, (...args: any[]) => any>;

    /**
     * 脚本执行超时时间（毫秒），默认 5000ms
     */
    timeout?: number;
}

/**
 * 脚本执行结果
 */
export interface ScriptExecutionResult<T = any> {
    /**
     * 执行结果
     */
    result: T;

    /**
     * 执行时间（毫秒）
     */
    executionTime?: number;
}

/**
 * 脚本执行错误
 */
export class ScriptExecutionError extends Error {
    constructor(
        message: string,
        public readonly script: string,
        public readonly originalError?: any
    ) {
        super(message);
        this.name = 'ScriptExecutionError';
    }
}

export interface IScriptsAdapter {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T>;
}
