import {Actor, AppError, getDefinedErrorMessageByKey, logger} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {LOG_TAGS, storeEntry, ValueWithUpdateTime} from "../../types";
import {kernelCoreBaseErrorMessages} from "../../supports/errors";
import {errorMessagesActions} from "../slices/errorMessages";
import {moduleName} from "../../moduleName";

export class ErrorMessagesActor extends Actor {
    updateErrorMessages =
        Actor.defineCommandHandler(kernelCoreBaseCommands.updateErrorMessages,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "ErrorMessagesActor"], 'updateErrorMessages')
                const keysNotFound: string[] = [];
                const keysFound: string[] = [];
                Object.keys(command.payload).forEach(key => {
                    const definedErrorMessage = getDefinedErrorMessageByKey(key)
                    if (!definedErrorMessage) {
                        keysNotFound.push(key);
                    }
                    keysFound.push(key);
                })
                if (keysFound.length > 0) {
                    const updateState: Record<string, ValueWithUpdateTime<string> | undefined | null> = {}
                    keysFound.forEach(key => {
                        updateState[key] = command.payload[key]
                    })
                    storeEntry.dispatchAction(errorMessagesActions.batchUpdateState(updateState))
                }
                if (keysNotFound.length > 0) {
                    throw new AppError(kernelCoreBaseErrorMessages.errorMessageKeyNotExists, {keysNotFound: keysNotFound}, command)
                }
                return Promise.resolve({});
            });
}

