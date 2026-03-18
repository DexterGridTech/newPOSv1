import {Actor} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {
    displaySwitchConfirmModalPart,
} from "../../ui/modals/DisplaySwitchConfirmModal";

export class SwitchDisplayActor extends Actor {
    shouldSwitchToSecondaryDisplay = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.shouldSwitchToSecondaryDisplay,
        async (command): Promise<Record<string, any>> => {
            // 打开确认弹窗
            kernelCoreNavigationCommands.openModal({
                modal: {
                    ...displaySwitchConfirmModalPart,
                    id: 'display-switch-secondary',
                    description: '切换到副屏确认',
                    props: {
                        displayType: 'secondary',
                    },
                },
            }).executeInternally();
            return {};
        });

    shouldSwitchToPrimaryDisplay = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.shouldSwitchToPrimaryDisplay,
        async (command): Promise<Record<string, any>> => {
            // 打开确认弹窗
            kernelCoreNavigationCommands.openModal({
                modal: {
                    ...displaySwitchConfirmModalPart,
                    id: 'display-switch-primary',
                    description: '切换到主屏确认',
                    props: {
                        displayType: 'primary',
                    },
                },
            }).executeInternally();
            return {};
        });
}

