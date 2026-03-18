import {moduleName} from "../../moduleName";
import {kernelProductBaseCommands} from "../commands";
import {Actor, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {productActions} from "../slices/product";

export class ProductActor extends Actor {
    updateProduct =
        Actor.defineCommandHandler(kernelProductBaseCommands.updateProduct,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "ProductActor"], 'updateProduct')
                storeEntry.dispatchAction(productActions.batchUpdateState(command.payload))
                return Promise.resolve({});
            });
}

