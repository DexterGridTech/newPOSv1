import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSelector} from "react-redux";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {LOG_TAGS, logger, shortId, storeEntry} from "@impos2/kernel-core-base";
import {
    kernelPayBaseCommands,
    kernelPayBaseState,
    PaymentAmountType,
    PaymentRequest,
    selectPayingOrder,
    selectPaymentFunction,
    selectPaymentRequest,
} from "@impos2/kernel-pay-base";
import {useRequestStatus} from "@impos2/kernel-core-interconnection";
import {moduleName} from "../moduleName";

interface UsePaymentModalProps {
    modalId: string;
    paymentRequestCode: string;
}

export const usePaymentModal = ({modalId, paymentRequestCode}: UsePaymentModalProps) => {
    const paymentRequest = useSelector(useMemo(() => selectPaymentRequest(paymentRequestCode), [paymentRequestCode]));
    const payingOrder = useSelector(useMemo(() => selectPayingOrder(paymentRequest?.mainOrderCode ?? ''), [paymentRequest?.mainOrderCode]));
    const paymentFunction = useSelector(useMemo(() => selectPaymentFunction(paymentRequest?.paymentFunctionKey ?? ''), [paymentRequest?.paymentFunctionKey]));

    const handledRef = useRef<string | null>(null);
    const [requestId, setRequestId] = useState<string | null>(null);
    const payStatus = useRequestStatus(requestId);
    // 页面加载完成后触发一次
    useEffect(() => {
        if (paymentRequest) {
            const paymentFunctionState = storeEntry.getStateByKey(kernelPayBaseState.paymentFunction)
            const paymentFunction = paymentFunctionState[paymentRequest.paymentFunctionKey]?.value
            if (paymentFunction?.definition?.paymentAmountType === PaymentAmountType.DYNAMIC) {
                runPaymentRequest(paymentRequest, paymentRequest.amount)
            }
        }
    }, []);
    useEffect(() => {
        if (payStatus?.status === 'complete' && requestId && handledRef.current !== requestId) {
            handledRef.current = requestId;
            logger.log([moduleName, LOG_TAGS.Hook, 'usePaymentModal'], '支付成功', payStatus.results);
        }
    }, [payStatus?.status, requestId]);

    const handleCloseAndRemove = useCallback(() => {
        kernelPayBaseCommands.removePaymentRequest({paymentRequestCode: paymentRequest!.paymentRequestCode}).executeInternally();
        kernelCoreNavigationCommands.closeModal({modalId}).executeInternally();
    }, [modalId, paymentRequest]);

    // 确认收单金额并发起支付，amount 单位：分（整数）
    const handleConfirmAmount = useCallback((amount: number) => {
        // 防止命令执行中重复提交
        if (payStatus?.status === 'started') return;
        runPaymentRequest(paymentRequest!, amount)
    }, [payStatus?.status, paymentRequest]);

    const runPaymentRequest = (paymentRequest: PaymentRequest, amount: number) => {
        const id = shortId();
        setRequestId(id);
        kernelPayBaseCommands.runPaymentRequest({
            paymentRequestCode: paymentRequest!.paymentRequestCode,
            amount,
        }).execute(id, paymentRequest!.mainOrderCode);
    }

    return {
        handleCloseAndRemove,
        handleConfirmAmount,
        payStatus,
        paymentRequest,
        payingOrder,
        paymentFunction,
    };
};
