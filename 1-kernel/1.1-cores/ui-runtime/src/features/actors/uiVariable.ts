import {Actor} from "@impos2/kernel-core-base";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {kernelCoreUiRuntimeCommands} from "../commands";
import {uiVariableActions} from "../slices/uiVariables";

export class UiVariableActor extends Actor {
    setUiVariables = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.setUiVariables,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariableActions.updateUiVariables(command.payload), command)
            return {};
        });

    clearUiVariables = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.clearUiVariables,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariableActions.clearUiVariables(command.payload), command)
            return {};
        });
}
