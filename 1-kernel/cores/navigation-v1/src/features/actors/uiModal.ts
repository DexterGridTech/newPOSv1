import {Actor} from "@impos2/kernel-core-base-v1";
import {kernelCoreNavigationCommands} from "../commands";
import {dispatchWorkspaceAction, getDisplayMode} from "@impos2/kernel-core-interconnection-v1";
import {uiVariablesActions} from "../slices/uiVariables";

export class UiModalActor extends Actor {
    openModal = Actor.defineCommandHandler(kernelCoreNavigationCommands.openModal,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariablesActions.openModal({
                displayMode: getDisplayMode(),
                model: command.payload.model
            }), command)
            return {};
        });
    closeModal = Actor.defineCommandHandler(kernelCoreNavigationCommands.closeModal,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariablesActions.closeModal({
                displayMode: getDisplayMode(),
                modelId: command.payload.modelId
            }), command)
            return {};
        });
}

