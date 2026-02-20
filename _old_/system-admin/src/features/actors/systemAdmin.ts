import {LongPressCommand} from "_old_/base-2";
import {AppError, CommandHandler, IActor} from "_old_/base";
import {AdminLoginCommand} from "../commands";
import {SystemAdminErrors} from "../errors";
import {adminLoginModalPart, adminPanelModalPart} from "../../ui";
import {nanoid} from "@reduxjs/toolkit";
import {createModelScreen, OpenModalCommand} from "_old_/base";

class SystemAdminActor extends IActor {
    @CommandHandler(LongPressCommand)
    private async handleLongPress(command: LongPressCommand) {
        const model =
            createModelScreen(adminLoginModalPart, nanoid(8), {})
        new OpenModalCommand({model: model}).executeFromParent(command)
    }

    @CommandHandler(AdminLoginCommand)
    private async handleAdminLogin(command: AdminLoginCommand) {
        const adminPassword = command.payload.adminPassword

        // 验证密码
        if (adminPassword === '123') {
            const adminPanelModel =
                createModelScreen(adminPanelModalPart, nanoid(8), {})
            new OpenModalCommand({model: adminPanelModel}).executeInternally()
        } else {
            throw new AppError(SystemAdminErrors.ADMIN_LOGIN_FAILED);
        }
    }
}

export const systemAdminActor = new SystemAdminActor()