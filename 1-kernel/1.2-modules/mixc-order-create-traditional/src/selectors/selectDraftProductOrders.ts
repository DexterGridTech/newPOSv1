import { createSelector } from 'reselect';
import { RootState } from '@impos2/kernel-core-base';
import { kernelCoreInterconnectionState } from '@impos2/kernel-core-interconnection';
import { CreateOrderState } from '../types/state/createOrderState';
import { kernelMixcOrderCreateTraditionalWorkspaceState } from '../types/shared/moduleStateKey';

const selectCreateOrderState = (state: RootState): CreateOrderState | undefined => {
    const workspace = (state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as any)?.workspace ?? 'main';
    const stateKey = `${kernelMixcOrderCreateTraditionalWorkspaceState.createOrder}.${workspace}`;
    return state[stateKey as keyof RootState] as CreateOrderState | undefined;
};

export const selectDraftProductOrders = createSelector(
    [selectCreateOrderState],
    (createOrderState) => createOrderState?.draftProductOrders?.value || []
);

export const selectSelectedProductOrder = createSelector(
    [selectCreateOrderState],
    (createOrderState) => createOrderState?.selected?.value || ''
);

export const selectProductOrderTotalAmount = createSelector(
    [selectCreateOrderState],
    (createOrderState) => createOrderState?.total?.value || 0
);

export const selectProductOrderSessionId = createSelector(
    [selectCreateOrderState],
    (createOrderState) => createOrderState?.sessionId?.value || ''
);

