import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {uiMixcTradeCommands} from "../commands";

export class PaymentActor extends Actor {
    applyPaymentFunction = Actor.defineCommandHandler(uiMixcTradeCommands.applyPaymentFunction,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "PaymentFunctionActor"], 'apply Payment Function')


            return {};
        });
}

