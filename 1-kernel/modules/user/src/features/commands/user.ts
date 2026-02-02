import {defineCommand, ExecutionType} from "@impos2/kernel-base";
import {UserModuleCommandNames} from "./commandNames";

export class UserPasswordLoginCommand extends defineCommand<{userId:string,password:string}>(
    UserModuleCommandNames.UserPasswordLogin,
    ExecutionType.SLAVE_SEND_MASTER_EXECUTE
) {}


export class UserLogoutCommand extends defineCommand<void>(
    UserModuleCommandNames.UserLogout,
    ExecutionType.SLAVE_SEND_MASTER_EXECUTE
) {}

export class UserLoginCompleteCommand extends defineCommand<void>(
    UserModuleCommandNames.UserLoginComplete,
    ExecutionType.SLAVE_SEND_MASTER_EXECUTE
) {}

export class UserLogoutCompleteCommand extends defineCommand<void>(
    UserModuleCommandNames.UserLogoutComplete,
    ExecutionType.SLAVE_SEND_MASTER_EXECUTE
) {}
