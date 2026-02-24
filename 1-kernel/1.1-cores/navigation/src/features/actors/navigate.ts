import {Actor, AppError} from "@impos2/kernel-core-base";
import {kernelCoreNavigationCommands} from "../commands";
import {dispatchWorkspaceAction, getDisplayMode} from "@impos2/kernel-core-interconnection";
import {uiVariablesActions} from "../slices/uiVariables";
import {kernelCoreNavigationErrorMessages} from "../../supports";

export class NavigateActor extends Actor {
    navigateTo = Actor.defineCommandHandler(kernelCoreNavigationCommands.navigateTo,
        async (command): Promise<Record<string, any>> => {
            const {containerKey} = command.payload.target;
            if (containerKey)
                kernelCoreNavigationCommands.setUiVariables({
                    [containerKey]: command.payload.target
                }).executeInternally();
            else {
                throw new AppError(kernelCoreNavigationErrorMessages.navigationError, {reasons: ['containerKey is required']})
            }
            return {};
        });
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

