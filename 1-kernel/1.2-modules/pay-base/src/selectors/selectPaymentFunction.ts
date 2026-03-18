import {createSelector} from "@reduxjs/toolkit";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {getInstanceMode} from "@impos2/kernel-core-interconnection";
import {kernelPayBaseState} from "../types/shared/moduleStateKey";
import {PaymentFunctionState} from "../types/state/paymentFunction";
import {PaymentFunction} from "../types/shared/paymentFunction";

const selectPaymentFunctionState = (state: any): PaymentFunctionState => {
    return state[kernelPayBaseState.paymentFunction] || {};
};

const selectInstanceMode = () => getInstanceMode();

export const selectPaymentFunction = (key: string) =>
    createSelector(
        [selectPaymentFunctionState],
        (paymentFunctionState: PaymentFunctionState): PaymentFunction | undefined => {
            return paymentFunctionState[key]?.value;
        }
    );

export const selectPaymentFunctions = createSelector(
    [selectPaymentFunctionState, selectInstanceMode],
    (paymentFunctionState: PaymentFunctionState, currentInstanceMode): PaymentFunction[] => {
        const paymentFunctionWrappers = Object.values(paymentFunctionState).filter(Boolean);

        return paymentFunctionWrappers
            .map((wrapper: ValueWithUpdatedAt<PaymentFunction>) => wrapper.value)
            .filter((paymentFunction): paymentFunction is PaymentFunction =>
                paymentFunction != null && paymentFunction.instanceMode != null
            )
            .filter((paymentFunction: PaymentFunction) =>
                paymentFunction.instanceMode.includes(currentInstanceMode)
            );
    }
);
