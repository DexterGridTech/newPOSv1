import {defineCommand, ExecutionType} from "../../../core/command";
import {BaseModuleCommandNames} from "../commandNames";
import {UIVariable} from "../../../core";


export class SetUiVariablesCommand extends defineCommand<{
    uiVariables: { [key: string]: any }
}>(
    BaseModuleCommandNames.SetUiVariables,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}


export class ClearUiVariablesCommand extends defineCommand<{
    uiVariableKeys: string[]
}>(
    BaseModuleCommandNames.ClearUiVariables,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
