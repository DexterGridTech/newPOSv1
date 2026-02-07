import {LongPressCommand} from "@impos2/ui-core-base-2";
import {AppError, CommandHandler, IActor, LOG_TAGS, logger} from "@impos2/kernel-base";
import {AdminLoginCommand} from "../commands";
import {moduleName} from "../../types";
import {SystemAdminErrors} from "../errors";
import {adminLoginModalPart} from "../../ui";
import {nanoid} from "@reduxjs/toolkit";
import {createModelScreen, OpenModalCommand} from "@impos2/kernel-module-ui-navigation";

class SystemAdminActor extends IActor {
    @CommandHandler(LongPressCommand)
    private async handleLongPress(command: LongPressCommand) {
        const model =
            createModelScreen(adminLoginModalPart, nanoid(8), {})
        new OpenModalCommand({model: model}).executeFromParent(command)
    }

    @CommandHandler(AdminLoginCommand)
    private async handleAdminLogin(command: AdminLoginCommand) {
        // 从 UI 变量中读取密码
        const adminPassword = command.payload.adminPassword

        logger.log([moduleName, LOG_TAGS.System, 'SystemAdminActor'], '管理员登录尝试', {
            timestamp: new Date().toISOString(),
        });

        // 验证密码
        if (adminPassword === '123') {
            logger.log([moduleName, LOG_TAGS.System, 'SystemAdminActor'], '管理员登录成功', {
                timestamp: new Date().toISOString(),
            });
            // 登录成功，可以在这里设置登录状态等
        } else {
            logger.error([moduleName, LOG_TAGS.System, 'SystemAdminActor'], '管理员登录失败：密码错误', {
                timestamp: new Date().toISOString(),
            });
            // 抛出错误
            throw new AppError(SystemAdminErrors.ADMIN_LOGIN_FAILED);
        }
    }
}

export const systemAdminActor = new SystemAdminActor()