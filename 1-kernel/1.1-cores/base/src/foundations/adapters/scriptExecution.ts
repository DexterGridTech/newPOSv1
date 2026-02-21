import {ScriptExecutionOptions} from "../../types/foundations/scriptExecution";

export interface ScriptsExecution {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T>;
}

export const scriptsExecution : ScriptsExecution = {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        if (!registeredScriptsExecution) {
            throw new Error('Scripts execution adapter not registered')
        }
        return registeredScriptsExecution.executeScript(options);
    }
}
let registeredScriptsExecution: ScriptsExecution | undefined;

export function registerScriptsExecution(scriptsExecution: ScriptsExecution) {
    registeredScriptsExecution = scriptsExecution;
}

