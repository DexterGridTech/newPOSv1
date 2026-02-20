import {Actor} from "@impos2/kernel-core-base";
import {kernelCoreNavigationCommands} from "../commands";
import {dispatchWorkspaceAction, getDisplayMode} from "@impos2/kernel-core-interconnection";
import {uiVariablesActions} from "../slices/uiVariables";

export class UiModalActor extends Actor {
    openModal = Actor.defineCommandHandler(kernelCoreNavigationCommands.openModal,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariablesActions.openModal({
                displayMode: getDisplayMode(),
                modal: command.payload.modal
            }), command)
            return {};
        });
    closeModal = Actor.defineCommandHandler(kernelCoreNavigationCommands.closeModal,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(uiVariablesActions.closeModal({
                displayMode: getDisplayMode(),
                modalId: command.payload.modalId
            }), command)
            return {};
        });
}

