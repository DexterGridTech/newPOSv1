import type {ScriptsExecution, ScriptExecutionOptions} from '@impos2/kernel-core-base';
import {getHostBridge} from './hostBridge';

class LocalScriptExecutionError extends Error {
  constructor(
    message: string,
    public readonly script: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ScriptExecutionError';
  }
}

export const scriptExecutionAdapter: ScriptsExecution = {
  async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
    const {
      script,
      params = {},
      globals = {},
      nativeFunctions = {},
      timeout = 5000,
    } = options;

    if (!script?.trim()) {
      throw new LocalScriptExecutionError('Script cannot be empty', script);
    }

    if (Object.keys(nativeFunctions).length > 0) {
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          reject(new LocalScriptExecutionError(`Script execution timed out (${timeout}ms)`, script));
        }, timeout);

        try {
          const fn = new Function(
            'params',
            ...Object.keys(globals),
            ...Object.keys(nativeFunctions),
            script,
          );
          Promise.resolve(
            fn(
              params,
              ...Object.values(globals),
              ...Object.values(nativeFunctions),
            ),
          ).then(
            result => {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              resolve(result as T);
            },
            error => {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              reject(new LocalScriptExecutionError(error?.message ?? String(error), script, error));
            },
          );
        } catch (error) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          reject(new LocalScriptExecutionError(
            error instanceof Error ? error.message : String(error),
            script,
            error,
          ));
        }
      });
    }

    return getHostBridge().scriptsExecution.executeScript(options);
  },
};
