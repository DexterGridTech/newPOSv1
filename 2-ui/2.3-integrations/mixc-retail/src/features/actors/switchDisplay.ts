import {Actor} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "@impos2/kernel-core-interconnection";
import {createModalScreen, kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {
    displaySwitchConfirmModalPart,
} from "../../ui/modals/DisplaySwitchConfirmModal";

export class SwitchDisplayActor extends Actor {
    shouldSwitchToSecondaryDisplay = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.shouldSwitchToSecondaryDisplay,
        async (command): Promise<Record<string, any>> => {
            kernelCoreNavigationCommands.openModal({
                modal: createModalScreen(displaySwitchConfirmModalPart, 'display-switch-secondary', {
                    displayType: 'secondary'
                })
            }).executeInternally();
            return {};
        });

    shouldSwitchToPrimaryDisplay = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.shouldSwitchToPrimaryDisplay,
        async (command): Promise<Record<string, any>> => {
            kernelCoreNavigationCommands.openModal({
                modal: createModalScreen(displaySwitchConfirmModalPart, 'display-switch-primary', {
                    displayType: 'primary'
                })
            }).executeInternally();
            return {};
        });
}

