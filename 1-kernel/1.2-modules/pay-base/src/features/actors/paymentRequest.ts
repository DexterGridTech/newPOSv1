import {moduleName} from "../../moduleName";
import {Actor, AppError, LOG_TAGS, logger, storeEntry, PERSIST_KEY} from "@impos2/kernel-core-base";
import {kernelPayBaseCommands} from "../commands";
import {PaymentRequest, PaymentRequestState, PaymentRequestStatus} from "../../types";
import {kernelPayBaseWorkspaceState} from "../../types/shared/moduleStateKey";
import {kernelPayBaseErrorMessages} from "../../supports";
import {PaymentWithdrawStatus} from "@impos2/kernel-order-base";
import {dispatchWorkspaceAction, getWorkspaceStateKey} from "@impos2/kernel-core-interconnection";
import {paymentRequestActions} from "../slices/paymentRequest";

export class PaymentRequestActor extends Actor {
    applyPaymentFunction = Actor.defineCommandHandler(kernelPayBaseCommands.applyPaymentFunction,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "PaymentRequestActor"], 'apply Payment Function',command.payload.paymentRequestCode)
            const {payingOrder, paymentFunction, paymentRequestCode} = command.payload;

            const paymentRequestState = storeEntry.getStateByKey(getWorkspaceStateKey(kernelPayBaseWorkspaceState.paymentRequest) as any) as PaymentRequestState
            let unfinishedPaymentRequest = false
            Object.entries(paymentRequestState).forEach(([key, paymentRequest]) => {
                if (key === PERSIST_KEY || !paymentRequest.value) return
                if (paymentRequest.value.mainOrderCode === payingOrder.mainOrderCode &&
                    (paymentRequest.value.paymentRequestStatus === PaymentRequestStatus.PENDING || paymentRequest.value.paymentRequestStatus === PaymentRequestStatus.CREATED))
                    unfinishedPaymentRequest = true
            })
            if (unfinishedPaymentRequest)
                throw new AppError(kernelPayBaseErrorMessages.mainOrderHasUnfinishedPaymentRequest)

            // 所有 amount 均为整数分，整数加减无精度问题
            // 待支付金额（分）= 订单金额 - 已支付金额 + 已撤销金额
            let amount = 0;
            const totalPaid = (payingOrder.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
            const withdrawnPaymentCodes = new Set(
                (payingOrder.paymentWithdraws ?? [])
                    .filter(w => w.paymentWithdrawStatus === PaymentWithdrawStatus.COMPLETED)
                    .map(w => w.paymentCode)
            );
            const totalWithdrawn = (payingOrder.payments ?? [])
                .filter(p => withdrawnPaymentCodes.has(p.paymentCode))
                .reduce((sum, p) => sum + p.amount, 0);
            amount = (payingOrder.amount ?? 0) - totalPaid + totalWithdrawn;

            const paymentRequest: PaymentRequest = {
                mainOrderCode: payingOrder.mainOrderCode!,
                paymentFunctionKey: paymentFunction.key,
                paymentRequestCode: paymentRequestCode,
                paymentRequestStatus: PaymentRequestStatus.CREATED,
                amount: amount, // 单位：分（整数）
                extra: {},
            }
            dispatchWorkspaceAction(paymentRequestActions.addPaymentRequest(paymentRequest),command)
            return {};
        });
    removePaymentRequest = Actor.defineCommandHandler(kernelPayBaseCommands.removePaymentRequest,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "PaymentRequestActor"], 'remove Payment Request')
            dispatchWorkspaceAction(paymentRequestActions.removePaymentRequest(command.payload.paymentRequestCode),command)
            return {};
        });
}

