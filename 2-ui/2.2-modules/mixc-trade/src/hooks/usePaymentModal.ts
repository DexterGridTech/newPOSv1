import {useCallback} from "react";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {moduleName} from "../moduleName";

interface UsePaymentModalProps {
    modalId: string;
    mainOrderCode: string;
    paymentFunctionKey: string;
}

export const usePaymentModal = ({modalId}: UsePaymentModalProps) => {
    const handleClose = useCallback(() => {

        logger.log([moduleName, LOG_TAGS.Reducer, "usePaymentModal"], '………………………………………………》handleClose')
        kernelCoreNavigationCommands.closeModal({modalId}).executeInternally();
    }, [modalId]);

    return {
        handleClose
    };
};
