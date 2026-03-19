import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelPayBaseErrorMessages = {
    mainOrderHasUnfinishedPaymentRequest: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "订单存在未完成的支付请求",
        'main.order.has.unfinished.payment.request',
        "订单存在未完成的支付请求"
    ),
    paymentRequestIsNotFound: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "支付请求不存在",
        'payment.request.is.not.found',
        "支付请求不存在"
    ),
    paymentFunctionIsNotFound: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "支付方法不存在",
        'payment.function.is.not.found',
        "支付方法不存在"
    ),
    payingOrderIsNotFound: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "支付订单不存在",
        'paying.order.is.not.found',
        "支付订单不存在"
    ),
};