import {createModuleCommands, defineCommand, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelUserBaseCommands = createModuleCommands(moduleName, {
    loginWithPassword: defineCommand<{ userName: string, password: string }>(),
    sendVerifyCode: defineCommand<{ mobile: string }>(),
    loginWithMobile: defineCommand<{ mobile: string, verifyCode: string }>(),
    loginWithBarcode: defineCommand<void>(),
    loginSuccess: defineCommand<void>(),
    logout: defineCommand<void>(),
    updateUserState: defineCommand<Record<string, ValueWithUpdatedAt<any> | undefined | null>>()
})

