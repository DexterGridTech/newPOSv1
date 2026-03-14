import {moduleName} from "../../moduleName";
import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {kernelMixcOrderCreateTraditionalCommands} from "../commands";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {createOrderActions} from "../slices/createOrder";

export class ProductOrderActor extends Actor {
    addProductOrder = Actor.defineCommandHandler(kernelMixcOrderCreateTraditionalCommands.addProductOrder,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'add product order')
            dispatchWorkspaceAction(createOrderActions.addProductOrder(command.payload),command)
            return {};
        });
}

