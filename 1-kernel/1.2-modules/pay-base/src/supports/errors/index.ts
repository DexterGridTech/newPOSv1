import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelPayBaseErrorMessages = {
    mainOrderHasUnfinishedPaymentRequest: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "订单存在未完成的支付请求",
        'main.order.has.unfinished.payment.request',
        "订单存在未完成的支付请求"
    ),
};