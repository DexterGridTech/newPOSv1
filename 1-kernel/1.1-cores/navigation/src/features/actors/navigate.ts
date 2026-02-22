import {Actor, AppError} from "@impos2/kernel-core-base";
import {kernelCoreNavigationCommands} from "../commands";
import {dispatchWorkspaceAction, getDisplayMode} from "@impos2/kernel-core-interconnection";
import {uiVariablesActions} from "../slices/uiVariables";
import {kernelCoreNavigationErrorMessages} from "../../supports";

export class NavigateActor extends Actor {
    navigateTo = Actor.defineCommandHandler(kernelCoreNavigationCommands.navigateTo,
        async (command): Promise<Record<string, any>> => {
            const {target} = command.payload;
            const {partKey, containerKey} = target;
            if (partKey && containerKey)
                kernelCoreNavigationCommands.setUiVariables({
                    [containerKey]: partKey
                }).executeInternally();
            else {
                const reasons: string[] = []
                if (!partKey) reasons.push(`partKey is required`)
                if (!containerKey) reasons.push(`containerKey is required`)
                throw new AppError(kernelCoreNavigationErrorMessages.navigationError, {reasons: reasons})
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

