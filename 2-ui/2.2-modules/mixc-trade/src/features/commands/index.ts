import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {PayingMainOrder, PaymentFunction} from "@impos2/kernel-mixc-order-pay";

export const uiMixcTradeCommands = createModuleCommands(moduleName,{
    setOrderCreationTypeToActive: defineCommand<void>(),
    setOrderCreationTypeToPassive: defineCommand<void>(),
    setSelectedPayingOrder: defineCommand<string>(),
    applyPaymentFunction:defineCommand<{payingOrder:PayingMainOrder,paymentFunction:PaymentFunction}>(),
})

