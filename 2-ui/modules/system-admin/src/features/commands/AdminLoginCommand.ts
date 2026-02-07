import { defineCommand, ExecutionType } from "@impos2/kernel-base";
import { SystemAdminCommandNames } from "./commandNames";

/**
 * 管理员登录命令
 *
 * 职责：
 * 1. 触发登录验证流程
 * 2. 密码从 systemAdminVariable.adminPassword 读取
 */
export class AdminLoginCommand extends defineCommand<{adminPassword: string}>(
    SystemAdminCommandNames.AdminLogin,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
