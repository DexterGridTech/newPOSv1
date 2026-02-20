import {Actor} from "@impos2/kernel-core-base";
import {kernelCoreNavigationCommands} from "../commands";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {uiVariablesActions} from "../slices/uiVariables";

export class UiVariableActor extends Actor {
    setUiVariables = Actor.defineCommandHandler(kernelCoreNavigationCommands.setUiVariables,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariablesActions.updateUiVariables(command.payload), command)
            return {};
        });
    clearUiVariables = Actor.defineCommandHandler(kernelCoreNavigationCommands.clearUiVariables,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariablesActions.clearUiVariables(command.payload), command)
            return {};
        });
}

