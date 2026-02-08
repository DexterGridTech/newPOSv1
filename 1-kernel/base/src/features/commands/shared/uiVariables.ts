import {defineCommand, ExecutionType} from "../../../core/command";
import {BaseModuleCommandNames} from "../commandNames";


export class SetUiVariablesCommand extends defineCommand<{
    uiVariables: { [key: string]: any }
}>(
    BaseModuleCommandNames.SetUiVariables,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
