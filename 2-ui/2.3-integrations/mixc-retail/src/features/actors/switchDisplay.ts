import {Actor} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {displaySwitchConfirmModalPartKey} from "../../ui/modals/DisplaySwitchConfirmModal";

export class SwitchDisplayActor extends Actor {
    shouldSwitchToSecondaryDisplay = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.shouldSwitchToSecondaryDisplay,
        async (command): Promise<Record<string, any>> => {
            // 打开确认弹窗
            kernelCoreNavigationCommands.openModal({
                modal: {
                    id: 'display-switch-secondary',
                    partKey: displaySwitchConfirmModalPartKey,
                    name: 'DisplaySwitchConfirm',
                    title: '切换显示',
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
                    id: 'display-switch-primary',
                    partKey: displaySwitchConfirmModalPartKey,
                    name: 'DisplaySwitchConfirm',
                    title: '切换显示',
                    description: '切换到主屏确认',
                    props: {
                        displayType: 'primary',
                    },
                },
            }).executeInternally();
            return {};
        });
}

