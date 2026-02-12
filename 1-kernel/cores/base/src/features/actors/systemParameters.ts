import {AppError, getSystemParameterByKey, IActor} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {storeEntry, ValueWithUpdate} from "../../types";
import {kernelCoreBaseSlice} from "../slices";
import {kernelCoreBaseErrorMessages} from "../../supports/errors";

export class SystemParametersActor extends IActor {
    updateSystemParameters =
        IActor.defineCommandHandler(kernelCoreBaseCommands.updateSystemParameters,
            (command): Promise<Record<string, any>> => {
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
                    const updatedState: Record<string, ValueWithUpdate<any> | undefined | null> = {};
                    keysFound.forEach(key => {
                        updatedState[key] = command.payload[key];
                    })
                    storeEntry.dispatchAction(kernelCoreBaseSlice.systemParameters.actions.batchUpdateState(updatedState))
                }
                if (keysNotFound.length > 0) {
                    throw new AppError(kernelCoreBaseErrorMessages.systemParameterKeyNotExists, {keysNotFound:keysNotFound}, command)
                }
                return Promise.resolve({});
            });
}

