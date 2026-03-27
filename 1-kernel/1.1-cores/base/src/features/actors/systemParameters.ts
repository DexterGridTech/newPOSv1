import {Actor, getSystemParameterByKey, logger} from "../../foundations";
import {kernelCoreBaseCommands} from "../commands";
import {LOG_TAGS, storeEntry, ValueWithUpdatedAt} from "../../types";
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
                    const valueWithUpdatedValue = command.payload[key]
                    if (!definedSystemParameter) {
                        keysNotFound.push(key);
                    } else {
                        keysFound.push(key);
                        if (valueWithUpdatedValue && valueWithUpdatedValue.value && typeof valueWithUpdatedValue.value === 'string') {
                            try {
                                valueWithUpdatedValue.value = JSON.parse(valueWithUpdatedValue.value);
                            } catch (e) {
                                logger.warn([moduleName, LOG_TAGS.Actor, "SystemParametersActor"], `Failed to parse value for key ${key}`, e);
                            }
                        }
                    }
                })
                if (keysFound.length > 0) {
                    const updateState: Record<string, ValueWithUpdatedAt<any> | undefined | null> = {};
                    keysFound.forEach(key => {
                        updateState[key] = command.payload[key];
                    })
                    storeEntry.dispatchAction(systemParametersActions.batchUpdateState(updateState))
                }
                if (keysNotFound.length > 0) {
                    logger.warn([moduleName, LOG_TAGS.Actor, "SystemParametersActor"], 'keysNotFound', keysNotFound)
                }
                return Promise.resolve({});
            });
}

