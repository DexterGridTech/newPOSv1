import {Actor, AppError, shortId} from "@impos2/kernel-core-base";
import {uiCoreBaseCommands} from "@impos2/ui-core-base";
import {uiAdminCommands} from "../commands";
import {createModelScreen, kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {uiAdminScreenParts} from "../../ui";
import {uiAdminErrorMessages} from "../../supports";
import {getStandalone} from "@impos2/kernel-core-interconnection";

export class AdminActor extends Actor {
    screenLongPressed = Actor.defineCommandHandler(uiCoreBaseCommands.screenLongPressed,
        async (command): Promise<Record<string, any>> => {
            const standalone = getStandalone()
            if (!standalone)
                return {};
            const adminPanelModel =
                createModelScreen(uiAdminScreenParts.adminLoginModal, shortId(), {})
            kernelCoreNavigationCommands.openModal({modal: adminPanelModel}).executeInternally()
            return {};
        });
    adminLogin = Actor.defineCommandHandler(uiAdminCommands.adminLogin,
        async (command): Promise<Record<string, any>> => {
            if (command.payload.adminPassword === '123') {
                const adminPanelModal =
                    createModelScreen(uiAdminScreenParts.adminPanelModal, shortId(), {})
                kernelCoreNavigationCommands.openModal({modal: adminPanelModal}).executeInternally()
            } else {
                throw new AppError(uiAdminErrorMessages.adminLoginFailed);
            }

            return {};
        });
}

