import {ActivateDeviceSuccessCommand, CommandHandler, IActor} from "@impos2/kernel-base";
import {NavigationCommand} from "@impos2/kernel-module-ui-navigation";
import {loginDesktopScreenPart} from "@impos2/ui-module-user-login-2";


class NavigatorActor extends IActor {
    @CommandHandler(ActivateDeviceSuccessCommand)
    private async handleActivateDeviceSuccess(command: ActivateDeviceSuccessCommand) {
        new NavigationCommand({target: loginDesktopScreenPart}).executeInternally()
    }
}

export const navigatorActor = new NavigatorActor();