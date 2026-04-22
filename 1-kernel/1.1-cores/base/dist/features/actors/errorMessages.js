import { Actor, getDefinedErrorMessageByKey, logger } from "../../foundations";
import { kernelCoreBaseCommands } from "../commands";
import { LOG_TAGS, storeEntry } from "../../types";
import { errorMessagesActions } from "../slices/errorMessages";
import { moduleName } from "../../moduleName";
export class ErrorMessagesActor extends Actor {
    updateErrorMessages = Actor.defineCommandHandler(kernelCoreBaseCommands.updateErrorMessages, async (command) => {
        logger.log([moduleName, LOG_TAGS.Actor, "ErrorMessagesActor"], 'updateErrorMessages');
        const keysNotFound = [];
        const keysFound = [];
        Object.keys(command.payload).forEach(key => {
            const definedErrorMessage = getDefinedErrorMessageByKey(key);
            if (!definedErrorMessage) {
                keysNotFound.push(key);
            }
            else {
                keysFound.push(key);
            }
        });
        if (keysFound.length > 0) {
            const updateState = {};
            keysFound.forEach(key => {
                updateState[key] = command.payload[key];
            });
            storeEntry.dispatchAction(errorMessagesActions.batchUpdateState(updateState));
        }
        if (keysNotFound.length > 0) {
            logger.warn([moduleName, LOG_TAGS.Actor, "ErrorMessagesActor"], 'keysNotFound', keysNotFound);
        }
        return Promise.resolve({});
    });
}
