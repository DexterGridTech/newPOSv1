import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {ProductOrderBase} from "@impos2/kernel-order-base";
import {PayingMainOrder, PaymentFunction} from "../../types";
import {PaymentRequest} from "../../types";

export const kernelPayBaseCommands = createModuleCommands(moduleName,{
    addPayingOrderFromDraft:defineCommand<ProductOrderBase[]>(),
    applyPaymentFunction:defineCommand<{payingOrder:PayingMainOrder,paymentFunction:PaymentFunction,paymentRequestCode:string}>(),
    removePaymentRequest:defineCommand<{paymentRequestCode:string}>(),
    runPaymentRequest:defineCommand<{paymentRequestCode:string,amount:number}>(),
    executePaymentTask:defineCommand<{paymentFunction:PaymentFunction,paymentRequest:PaymentRequest,payingMainOrder:PayingMainOrder,amount:number }>(),
})

