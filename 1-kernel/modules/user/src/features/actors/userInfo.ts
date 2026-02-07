import {
    AppError,
    CommandHandler,
    currentState,
    dispatchAction,
    IActor, ICommand,
    InitializeCommand,
    logger,
    LOG_TAGS,
    RootState
} from "@impos2/kernel-base";
import {
    UserLoginCompleteCommand,
    UserLogoutCommand,
    UserLogoutCompleteCommand,
    UserPasswordLoginCommand
} from "../commands/user";
import {UserErrors} from "../errors";
import {userInfoActions, userInfoSlice} from "../slices";
import {moduleName, User} from "../../types";

class UserInfoActor extends IActor {
    @CommandHandler(InitializeCommand)
    private async handleInitialize(command: InitializeCommand) {
        logger.log([moduleName, LOG_TAGS.Actor, 'UserInfoActor'], 'Initialize instance command received by user info actor')
    }

    @CommandHandler(UserPasswordLoginCommand)
    private async handleUserPasswordLogin(command: UserPasswordLoginCommand) {
        const state = currentState<RootState>()
        if (state[userInfoSlice.name].user) {
            throw new AppError(UserErrors.USER_ALREADY_LOGGED_IN, "", command)
        } else {
            //api login

            //mock
            await new Promise(resolve => setTimeout(resolve, 2000))
            if (command.payload.userId == command.payload.password) {
                const user: User = {
                    userId: "123",
                    userName: "Dexter"
                }
                dispatchAction(userInfoActions.setUser(user), command)
                new UserLoginCompleteCommand().executeFromParent(command)

                return {
                    [command.commandName]: user
                }
            } else {
                throw new AppError(UserErrors.USER_LOGIN_FAILED, "", command)
            }
        }
    }

    @CommandHandler(UserLogoutCommand)
    private async handleUserLogout(command: UserLogoutCommand) {
        const state = currentState<RootState>()
        if (!state[userInfoSlice.name].user) {
            throw new AppError(UserErrors.USER_NOT_LOGGED_IN, "", command)
        } else {
            //api logout

            dispatchAction(userInfoActions.clearUser(), command)
            new UserLogoutCompleteCommand().executeFromParent(command)
        }
    }

    @CommandHandler(UserLogoutCompleteCommand)
    @CommandHandler(UserLoginCompleteCommand)
    private async complete(command: ICommand<any>) {
        logger.log([moduleName, LOG_TAGS.Actor, 'UserInfoActor'], 'Complete command received by user info actor', command.commandName)
    }
}

export const userInfoActor = new UserInfoActor()