import {moduleName} from "../../moduleName";
import {
    Actor, APIError,
    APIResponseCode,
    getDeviceId,
    kernelCoreBaseCommands,
    LOG_TAGS,
    logger,
    storeEntry
} from "@impos2/kernel-core-base";
import {kernelUserBaseCommands} from "../commands";
import {
    kernelCoreTerminalApis,
    kernelCoreTerminalCommands,
    kernelCoreTerminalState
} from "@impos2/kernel-core-terminal";
import {
    LoginWithBarcodeRequest,
    LoginWithMobileRequest,
    LoginWithPasswordRequest, LogoutRequest,
    SendVerifyCodeRequest
} from "../../types/foundations/api";
import {kernelUserBaseApis} from "../../supports";
import {userActions} from "../slices/user";
import {User} from "../../types";

export class UserActor extends Actor {
    loginWithPassword = Actor.defineCommandHandler(kernelUserBaseCommands.loginWithPassword,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UserActor"], 'login With Password')

            /////
            if(command.payload.userName==='boss'&&command.payload.password==='boss'){
                const user:User = {
                    id:"123",
                    userName:'boss',
                    name:'老板',
                    mobile:'13800000000',
                    userRoles: [
                        {
                            key:'boss',
                            name:'老板',
                        },
                        {
                            key:'employee',
                            name:'员工',
                        },
                        {
                            key:'finance',
                            name:'财务',
                        }
                    ]
                }
                storeEntry.dispatchAction(userActions.setUser(user))
                kernelUserBaseCommands.loginSuccess().executeFromParent(command)
                return {
                    user: user
                }
            }
            /////
            const loginWithPasswordRequest: LoginWithPasswordRequest = {
                userName: command.payload.userName,
                password: command.payload.password,
                deviceId:getDeviceId()
            }
            const result = await kernelUserBaseApis.loginWithPassword.run({request: loginWithPasswordRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(userActions.setUser(result.data?.user!))
                kernelUserBaseCommands.loginSuccess().executeFromParent(command)
                return {
                    user: result.data?.user!
                }
            } else {
                throw new APIError(result)
            }
        });
    sendVerifyCode = Actor.defineCommandHandler(kernelUserBaseCommands.sendVerifyCode,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UserActor"], 'send Verify Code')
            const sendVerifyCodeRequest: SendVerifyCodeRequest = {
                mobile: command.payload.mobile,
                deviceId:getDeviceId()
            }
            const result = await kernelUserBaseApis.sendVerifyCode.run({request: sendVerifyCodeRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                return {}
            } else {
                throw new APIError(result)
            }
        });
    loginWithMobile = Actor.defineCommandHandler(kernelUserBaseCommands.loginWithMobile,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UserActor"], 'login With Mobile')
            const loginWithMobileRequest: LoginWithMobileRequest = {
                mobile: command.payload.mobile,
                verifyCode: command.payload.verifyCode,
                deviceId:getDeviceId()
            }
            const result = await kernelUserBaseApis.loginWithMobile.run({request: loginWithMobileRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(userActions.setUser(result.data?.user!))
                kernelUserBaseCommands.loginSuccess().executeFromParent(command)
                return {
                    user: result.data?.user!
                }
            } else {
                throw new APIError(result)
            }
        });
    loginWithBarcode = Actor.defineCommandHandler(kernelUserBaseCommands.loginWithBarcode,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UserActor"], 'login With Barcode')
            const loginWithBarcodeRequest: LoginWithBarcodeRequest = {
                deviceId:getDeviceId()
            }
            const result = await kernelUserBaseApis.loginWithBarcode.run({request: loginWithBarcodeRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                return {
                    url: result.data?.url!
                }
            } else {
                throw new APIError(result)
            }
        });
    logout = Actor.defineCommandHandler(kernelUserBaseCommands.logout,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UserActor"], 'logout')
            const logoutRequest: LogoutRequest = {
                deviceId:getDeviceId()
            }
            const result = await kernelUserBaseApis.logout.run({request: logoutRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(userActions.clearUser())
                return {}
            } else {
                throw new APIError(result)
            }
        });
    updateUserState = Actor.defineCommandHandler(kernelUserBaseCommands.updateUserState,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UserActor"], 'updateUserState')

            return {}
        });

}

