import {AppError, getDefinedErrorMessageByKey, IActor} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {storeEntry, ValueWithUpdate} from "../../types";
import {kernelCoreBaseSlice} from "../slices";
import {kernelCoreBaseErrorMessages} from "../../supports/errors";

export class ErrorMessagesActor extends IActor {
    updateErrorMessages =
        IActor.defineCommandHandler(kernelCoreBaseCommands.updateErrorMessages,
            (command): Promise<Record<string, any>> => {
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
                    const updateState: Record<string, ValueWithUpdate<string> | undefined | null> = {}
                    keysFound.forEach(key => {
                        updateState[key] = command.payload[key]
                    })
                    storeEntry.dispatchAction(kernelCoreBaseSlice.errorMessages.actions.batchUpdateState(updateState))
                }
                if (keysNotFound.length > 0) {
                    throw new AppError(kernelCoreBaseErrorMessages.errorMessageKeyNotExists, {keysNotFound: keysNotFound}, command)
                }
                return Promise.resolve({});
            });
}

