import {moduleName} from "../../moduleName";
import {kernelMixcProductCommands} from "../commands";
import {Actor, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {contractActions} from "../slices/contract";

export class ContractActor extends Actor {
    updateContracts =
        Actor.defineCommandHandler(kernelMixcProductCommands.updateContracts,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "ContractActor"], 'updateContracts')
                const updatedContracts = command.payload
                Object.keys(updatedContracts).forEach(key => {
                    const valueWithUpdatedValue = command.payload[key]
                    if (valueWithUpdatedValue && valueWithUpdatedValue.value && typeof valueWithUpdatedValue.value === 'string') {
                        try {
                            valueWithUpdatedValue.value = JSON.parse(valueWithUpdatedValue.value);
                        } catch (e) {
                            logger.error([moduleName, LOG_TAGS.Actor, "ContractActor"], `Failed to parse value for key ${key}`, e);
                        }
                    }
                })
                storeEntry.dispatchAction(contractActions.batchUpdateState(updatedContracts))
                return Promise.resolve({});
            });
}

