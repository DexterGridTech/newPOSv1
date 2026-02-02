import {defineCommand, ExecutionType} from "@impos2/kernel-base";
import {UiNavigationCommandNames} from "./commandNames";


export class SetUiVariablesCommand extends defineCommand<{
    uiVariables: { [key: string]: any }
}>(
    UiNavigationCommandNames.SetUiVariables,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
