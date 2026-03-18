import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {ProductOrderBase} from "@impos2/kernel-order-base";
import {PayingMainOrder, PaymentFunction} from "../../types";

export const kernelPayBaseCommands = createModuleCommands(moduleName,{
    addPayingOrderFromDraft:defineCommand<ProductOrderBase[]>(),
    applyPaymentFunction:defineCommand<{payingOrder:PayingMainOrder,paymentFunction:PaymentFunction,paymentRequestCode:string}>(),
    removePaymentRequest:defineCommand<{paymentRequestCode:string}>()
})

