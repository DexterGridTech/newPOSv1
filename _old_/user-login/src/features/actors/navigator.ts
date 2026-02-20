import {ActivateDeviceSuccessCommand, CommandHandler, IActor} from "_old_/base";


class NavigatorActor extends IActor {
    @CommandHandler(ActivateDeviceSuccessCommand)
    private async handleActivateDeviceSuccess(command: ActivateDeviceSuccessCommand): Promise<void> {
        // TODO: 实现设备激活成功后的导航逻辑
    }
}

export const navigatorActor = new NavigatorActor();