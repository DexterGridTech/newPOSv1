import {
    CommandHandler,
    currentState,
    dispatchSimpleAction, getInstance,
    IActor,
    instanceInfoSlice,
    logger,
    RootState
} from "@impos2/kernel-base";
import { NavigationCommand, SetUiVariablesCommand} from "../commands";
import {ScreenPart} from "../../types";
import {uiVariablesActions} from "../slices";
import {getScreenPartReadyToEnter} from "../../core";


class NavigatorActor extends IActor {
    @CommandHandler(NavigationCommand)
    private async handleNavigation(command: NavigationCommand) {
        try {
            const target: ScreenPart = command.payload.target;

            // 验证 containerKey 是否存在
            if (!target.containerKey) {
                throw new Error(`Screen part '${target.partKey}' has no containerKey`);
            }

            // 从注册表获取 readyToEnter 方法
            const readyToEnter = getScreenPartReadyToEnter(target.partKey);
            const isReady = readyToEnter ? readyToEnter() : true;

            if (!isReady) {
                throw new Error(`Screen part '${target.partKey}' is not ready to enter`);
            }

            // 使用 SetUiVariablesCommand 来更新 UI 变量
            new SetUiVariablesCommand({
                uiVariables: {
                    [target.containerKey]: target
                }
            }).executeInternally();
        } catch (error) {
            logger.error(`Navigation failed: ${error}`);
            throw error;
        }
    }

    @CommandHandler(SetUiVariablesCommand)
    private async handleSetUiVariables(command: SetUiVariablesCommand) {
        const instance = getInstance()
        dispatchSimpleAction(uiVariablesActions.update({
            instance: instance,
            uiVariables: command.payload.uiVariables
        }))
    }

}

export const navigatorActor = new NavigatorActor();
