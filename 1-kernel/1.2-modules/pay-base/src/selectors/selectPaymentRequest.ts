import {kernelCoreInterconnectionState} from "@impos2/kernel-core-interconnection";
import {kernelPayBaseWorkspaceState} from "../types/shared/moduleStateKey";
import {RootState} from "@impos2/kernel-core-base";
import {PaymentRequest, PaymentRequestState} from "../types";
import {createSelector} from "reselect";

const selectPaymentRequestState = (state: RootState): PaymentRequestState | undefined => {
    const workspace = (state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as any)?.workspace ?? 'main';
    const stateKey = `${kernelPayBaseWorkspaceState.paymentRequest}.${workspace}`;
    return state[stateKey as keyof RootState] as PaymentRequestState | undefined;
};

export const selectPaymentRequest = (paymentRequestCode: string) =>
    createSelector(
        [selectPaymentRequestState],
        (paymentRequestState): PaymentRequest | undefined => {
            if (!paymentRequestState) return undefined;
            return paymentRequestState[paymentRequestCode]?.value;
        }
    );