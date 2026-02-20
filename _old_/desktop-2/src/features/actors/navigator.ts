import {ActivateDeviceSuccessCommand, CommandHandler, IActor} from "_old_/base";
import {NavigationCommand} from "_old_/base";
import {loginDesktopScreenPart} from "@impos2/ui-module-user-login";


class NavigatorActor extends IActor {
    @CommandHandler(ActivateDeviceSuccessCommand)
    private async handleActivateDeviceSuccess(command: ActivateDeviceSuccessCommand) {
        new NavigationCommand({target: loginDesktopScreenPart}).executeInternally()
    }
}

export const navigatorActor = new NavigatorActor();