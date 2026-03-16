import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {uiMixcTradeCommands} from "../commands";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {orderCreationActions} from "../slices/orderCreation";
import {OrderCreationType} from "../../types/shared/orderCreationType";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {createOrderActiveScreenPart} from "../../ui/screens/CreateOrderActiveScreen";
import {createOrderPassiveScreenPart} from "../../ui/screens/CreateOrderPassiveScreen";

export class OrderCreationActor extends Actor {
    setOrderCreationTypeToPassive = Actor.defineCommandHandler(uiMixcTradeCommands.setOrderCreationTypeToPassive,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "OrderCreationActor"], 'set order creation type to passive')
            dispatchWorkspaceAction(orderCreationActions.setOrderCreationType(OrderCreationType.Passive), command)
            kernelCoreNavigationCommands.navigateTo({
                target: createOrderPassiveScreenPart
            }).executeFromParent(command);
            return {};
        });
    setOrderCreationTypeToActive = Actor.defineCommandHandler(uiMixcTradeCommands.setOrderCreationTypeToActive,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "OrderCreationActor"], 'set order creation type to active')
            dispatchWorkspaceAction(orderCreationActions.setOrderCreationType(OrderCreationType.Active), command)
            kernelCoreNavigationCommands.navigateTo({
                target: createOrderActiveScreenPart
            }).executeFromParent(command);
            return {};
        });
    setSelectedPayingOrder = Actor.defineCommandHandler(uiMixcTradeCommands.setSelectedPayingOrder,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "OrderCreationActor"], 'set selected paying order')
            dispatchWorkspaceAction(orderCreationActions.setSelectedPayingOrder(command.payload), command)
            return {};
        });
}

