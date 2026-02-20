import {CommandHandler, dispatchSimpleAction, IActor, logger, storeEntry} from "../../core";
import {LOG_TAGS} from "../../types";
import {ClearUiVariablesCommand, NavigationCommand, SetUiVariablesCommand} from "../commands/shared";
import {ScreenPart} from "../../types/core/screen";
import {uiVariablesActions} from "../slices/uiVariables";
import {getScreenPartReadyToEnter} from "../../core/screen";
import {moduleName} from "../../moduleName";


class NavigatorActor extends IActor {
    @CommandHandler(NavigationCommand)
    private async handleNavigation(command: NavigationCommand) {
        const {target} = command.payload;
        const {partKey, containerKey} = target;

        try {
            // 验证 containerKey
            this.validateContainerKey(containerKey, partKey);

            // 验证 ScreenPart 是否准备就绪
            this.validateScreenPartReady(partKey);

            // 更新 UI 变量
            this.updateUiVariable(containerKey, target);
        } catch (error) {
            logger.error(
                [moduleName, LOG_TAGS.Actor, 'NavigatorActor'],
                `Navigation to '${partKey}' failed:`,
                error
            );
            throw error;
        }
    }

    /**
     * 验证 containerKey 是否存在
     */
    private validateContainerKey(containerKey: string | null | undefined, partKey: string): asserts containerKey is string {
        if (!containerKey) {
            throw new Error(`Screen part '${partKey}' has no containerKey`);
        }
    }

    /**
     * 验证 ScreenPart 是否准备就绪
     */
    private validateScreenPartReady(partKey: string): void {
        const readyToEnter = getScreenPartReadyToEnter(partKey);

        // 如果没有定义 readyToEnter,默认为准备就绪
        if (!readyToEnter) {
            return;
        }

        const isReady = readyToEnter();
        if (!isReady) {
            throw new Error(`Screen part '${partKey}' is not ready to enter`);
        }
    }

    /**
     * 更新 UI 变量
     */
    private updateUiVariable(containerKey: string, target: ScreenPart): void {
        new SetUiVariablesCommand({
            uiVariables: {
                [containerKey]: target
            }
        }).executeInternally();
    }

    @CommandHandler(SetUiVariablesCommand)
    private async handleSetUiVariables(command: SetUiVariablesCommand) {
        const instance = storeEntry.getInstance()
        dispatchSimpleAction(uiVariablesActions.updateUiVariable({
            instance: instance,
            uiVariables: command.payload.uiVariables
        }))
    }
    @CommandHandler(ClearUiVariablesCommand)
    private async handleClearUiVariables(command: ClearUiVariablesCommand) {
        const instance = storeEntry.getInstance()
        dispatchSimpleAction(uiVariablesActions.clearUiVariables({
            instance: instance,
            uiVariableKeys: command.payload.uiVariableKeys
        }))
    }

}

export const navigatorActor = new NavigatorActor();
