import {NativeEventEmitter} from 'react-native';
import {
  type ScriptsExecution,
  type ScriptExecutionOptions,
  ScriptExecutionError,
} from '@impos2/kernel-core-base';
import NativeScriptsTurboModule from '../supports/apis/NativeScriptsTurboModule';

type NativeCallEvent = {
  callId: string;
  funcName: string;
  argsJson: string;
};

type NativeExecuteResult = {
  success: boolean;
  resultJson: string;
  error?: string | null;
  elapsedMs: number;
};

const emitter = new NativeEventEmitter(NativeScriptsTurboModule);
const EVENT_NATIVE_CALL = 'onNativeCall';

let nativeFunctionExecutionQueue: Promise<void> = Promise.resolve();

async function runExclusiveWithNativeFunctions<T>(work: () => Promise<T>): Promise<T> {
  const previous = nativeFunctionExecutionQueue;
  let release!: () => void;
  nativeFunctionExecutionQueue = new Promise<void>(resolve => {
    release = resolve;
  });

  await previous;
  try {
    return await work();
  } finally {
    release();
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
      throw new ScriptExecutionError('Script cannot be empty', script);
    }

    const nativeFuncNames = Object.keys(nativeFunctions);
    const execute = async (): Promise<T> => {
      const subscription = emitter.addListener(EVENT_NATIVE_CALL, async (event: NativeCallEvent) => {
        try {
          const fn = nativeFunctions[event.funcName];
          if (!fn) {
            await NativeScriptsTurboModule.rejectNativeCall(
              event.callId,
              `Unknown nativeFunction: ${event.funcName}`,
            );
            return;
          }
          const args = JSON.parse(event.argsJson) as any[];
          const result = await fn(...args);
          await NativeScriptsTurboModule.resolveNativeCall(
            event.callId,
            JSON.stringify(result ?? null),
          );
        } catch (error) {
          await NativeScriptsTurboModule.rejectNativeCall(
            event.callId,
            error instanceof Error ? error.message : String(error),
          );
        }
      });

      try {
        const result = (await NativeScriptsTurboModule.executeScript(
          script,
          JSON.stringify(params),
          JSON.stringify(globals),
          nativeFuncNames,
          timeout,
        )) as NativeExecuteResult;

        if (!result.success) {
          throw new ScriptExecutionError(result.error ?? 'Script execution failed', script);
        }

        return JSON.parse(result.resultJson) as T;
      } catch (error) {
        if (error instanceof ScriptExecutionError) {
          throw error;
        }
        throw new ScriptExecutionError(
          `Script execution failed: ${error instanceof Error ? error.message : String(error)}`,
          script,
          error,
        );
      } finally {
        subscription.remove();
      }
    };

    if (nativeFuncNames.length > 0) {
      return runExclusiveWithNativeFunctions(execute);
    }

    return execute();
  },
};
