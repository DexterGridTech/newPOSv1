import {moduleName} from "../../moduleName";
import {Actor, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {kernelPayBaseCommands} from "../commands";
import {PayingMainOrder} from "../../types";
import {
    generateMainOrderCode,
    generateProductOrderCode,
    generateSubOrderCode,
    MainOrderBaseStatus
} from "@impos2/kernel-order-base";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {payingOrderActions} from "../slices/payingOrder";

export class PayingOrderActor extends Actor {
    addPayingOrderFromDraft = Actor.defineCommandHandler(kernelPayBaseCommands.addPayingOrderFromDraft,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "PayingOrderActor"], 'add Paying Order From Draft')

            const mainOrderCode=generateMainOrderCode()
            const subOrderCode=generateSubOrderCode(mainOrderCode)

            const productOrders=command.payload
                .filter(productOrder=>productOrder.amount!= 0)
                .map((productOrder,index,all)=>({...productOrder,
                    saleTypeCode:generateProductOrderCode(subOrderCode,all.length,index),
                }))
            const amount=productOrders.reduce((total,productOrder)=>total+productOrder.amount,0)

            const payingMainOrder: PayingMainOrder = {
                mainOrderCode:mainOrderCode,
                amount:amount,
                subOrders:[
                    {
                        subOrderCode:subOrderCode,
                        productOrders:productOrders,
                        amount:amount,
                        extra:{}
                    }
                ],
                payments:[],
                paymentWithdraws:[],
                paymentShares:[],
                mainOrderStatus:MainOrderBaseStatus.CREATED,
                createdAt:Date.now(),
            }
            dispatchWorkspaceAction(payingOrderActions.addPayingOrderFromDraft(payingMainOrder),command)
            return {payingMainOrderCode:mainOrderCode};
        });
}

