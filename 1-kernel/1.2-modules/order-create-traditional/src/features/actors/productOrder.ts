import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelOrderCreateTraditionalCommands} from "../commands";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {createOrderActions} from "../slices/createOrder";

export class ProductOrderActor extends Actor {
    addProductOrder = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.addProductOrder,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'add product order')
            dispatchWorkspaceAction(createOrderActions.addProductOrder(command.payload), command)
            return {};
        });
    increaseProductOrderQuantity = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.increaseProductOrderQuantity,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'increase Product Order Quantity')
            dispatchWorkspaceAction(createOrderActions.increaseProductOrderQuantity({id: command.payload.productId}), command)
            return {};
        });
    decreaseProductOrderQuantity = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.decreaseProductOrderQuantity,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'decrease Product Order Quantity')
            dispatchWorkspaceAction(createOrderActions.decreaseProductOrderQuantity({id: command.payload.productId}), command)
            return {};
        });
    removeProductOrder = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.removeProductOrder,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'remove Product Order')
            dispatchWorkspaceAction(createOrderActions.removeProductOrder({id: command.payload.productId}), command)
            return {};
        });
    selectProductOrder = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.selectProductOrder,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'select Product Order')
            dispatchWorkspaceAction(createOrderActions.selectProductOrder({id: command.payload.productId}), command)
            return {};
        });
    setProductPrice = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.setProductPrice,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'set Product Price')
            dispatchWorkspaceAction(createOrderActions.setValueStr({char: command.payload.char}), command)
            return {};
        });
    clearProductOrder = Actor.defineCommandHandler(kernelOrderCreateTraditionalCommands.clearProductOrder,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "ProductOrderActor"], 'clear Product Order')
            dispatchWorkspaceAction(createOrderActions.clear(), command)
            return {};
        });
}

