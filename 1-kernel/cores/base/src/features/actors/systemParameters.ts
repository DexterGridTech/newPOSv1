import {AppError, getSystemParameterByKey, Actor, logger} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {LOG_TAGS, storeEntry, ValueWithUpdateAt} from "../../types";
import {kernelCoreBaseErrorMessages} from "../../supports/errors";
import {systemParametersActions} from "../slices/systemParameters";
import {moduleName} from "../../moduleName";

export class SystemParametersActor extends Actor {
    updateSystemParameters =
        Actor.defineCommandHandler(kernelCoreBaseCommands.updateSystemParameters,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "SystemParametersActor"], 'updateSystemParameters')
                const keysNotFound: string[] = [];
                const keysFound: string[] = [];
                Object.keys(command.payload).forEach(key => {
                    const definedSystemParameter = getSystemParameterByKey(key)
                    if (!definedSystemParameter) {
                        keysNotFound.push(key);
                    }
                    keysFound.push(key);
                })
                if (keysFound.length > 0) {
                    const updatedState: Record<string, ValueWithUpdateAt<any> | undefined | null> = {};
                    keysFound.forEach(key => {
                        updatedState[key] = command.payload[key];
                    })
                    storeEntry.dispatchAction(systemParametersActions.batchUpdateState(updatedState))
                }
                if (keysNotFound.length > 0) {
                    throw new AppError(kernelCoreBaseErrorMessages.systemParameterKeyNotExists, {keysNotFound: keysNotFound}, command)
                }
                return Promise.resolve({});
            });
}

