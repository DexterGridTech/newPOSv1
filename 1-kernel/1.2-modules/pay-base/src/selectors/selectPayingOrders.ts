import { createSelector } from 'reselect';
import { RootState } from '@impos2/kernel-core-base';
import { kernelCoreInterconnectionState } from '@impos2/kernel-core-interconnection';
import { PayingOrderState } from '../types/state/payingOrder';
import { kernelPayBaseWorkspaceState } from '../types/shared/moduleStateKey';
import { PayingMainOrder } from '../types/shared/payingMainOrder';

const selectPayingOrderState = (state: RootState): PayingOrderState | undefined => {
    const workspace = (state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as any)?.workspace ?? 'main';
    const stateKey = `${kernelPayBaseWorkspaceState.payingOrder}.${workspace}`;
    return state[stateKey as keyof RootState] as PayingOrderState | undefined;
};

export const selectPayingOrders = createSelector(
    [selectPayingOrderState],
    (payingOrderState): PayingMainOrder[] => {
        if (!payingOrderState) return [];

        return Object.values(payingOrderState)
            .map(item => item.value)
            .filter((order): order is PayingMainOrder => !!order)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
);

export const selectPayingOrder = (mainOrderCode: string) =>
    createSelector(
        [selectPayingOrderState],
        (payingOrderState): PayingMainOrder | undefined => {
            if (!payingOrderState) return undefined;
            return payingOrderState[mainOrderCode]?.value;
        }
    );
