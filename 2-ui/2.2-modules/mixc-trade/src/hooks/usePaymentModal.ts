import {useCallback, useMemo} from "react";
import {useSelector} from "react-redux";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {moduleName} from "../moduleName";
import {
    selectPaymentRequest,
    selectPayingOrder,
    selectPaymentFunction, kernelPayBaseCommands,
} from "@impos2/kernel-pay-base";

interface UsePaymentModalProps {
    modalId: string;
    paymentRequestCode: string;
}

export const usePaymentModal = ({modalId, paymentRequestCode}: UsePaymentModalProps) => {
    const paymentRequest= useSelector(useMemo(() => selectPaymentRequest(paymentRequestCode), [paymentRequestCode]));
    const payingOrder = useSelector(useMemo(() => selectPayingOrder(paymentRequest?.mainOrderCode ?? ''), [paymentRequest?.mainOrderCode]));
    const paymentFunction = useSelector(useMemo(() => selectPaymentFunction(paymentRequest?.paymentFunctionKey ?? ''), [paymentRequest?.paymentFunctionKey]));

    const handleCloseAndRemove = useCallback(() => {
        kernelPayBaseCommands.removePaymentRequest({paymentRequestCode:paymentRequest!.paymentRequestCode}).executeInternally();
        kernelCoreNavigationCommands.closeModal({modalId}).executeInternally();
    }, [modalId,paymentRequest]);

    return {
        handleCloseAndRemove,
        paymentRequest,
        payingOrder,
        paymentFunction,
    };
};
