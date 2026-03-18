import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {uiMixcTradeCommands} from "../commands";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {paymentModalPart} from "../../ui/modals/PaymentModal";

export class PaymentActor extends Actor {
    applyPaymentFunction = Actor.defineCommandHandler(uiMixcTradeCommands.applyPaymentFunction,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "PaymentFunctionActor"], 'apply Payment Function')
            const {payingOrder, paymentFunction} = command.payload;
            kernelCoreNavigationCommands.openModal({
                modal: {
                    ...paymentModalPart,
                    id: 'paymentModal',
                    description: '支付',
                    props: {
                        title: `支付方式：${paymentFunction.displayName}`,
                        mainOrderCode: payingOrder.mainOrderCode,
                        paymentFunctionKey: paymentFunction.key
                    },
                },
            }).executeInternally();

            return {};
        });
}

