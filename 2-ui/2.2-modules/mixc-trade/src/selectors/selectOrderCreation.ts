import { createSelector } from 'reselect';
import { RootState } from '@impos2/kernel-core-base';
import { kernelCoreInterconnectionState } from '@impos2/kernel-core-interconnection';
import { OrderCreationState } from '../types/state/orderCreation';
import { uiMixcTradeWorkspaceState } from '../types/shared/moduleStateKey';

const selectOrderCreationState = (state: RootState): OrderCreationState | undefined => {
    const workspace = (state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as any)?.workspace ?? 'main';
    const stateKey = `${uiMixcTradeWorkspaceState.orderCreation}.${workspace}`;
    return state[stateKey as keyof RootState] as OrderCreationState | undefined;
};

export const selectOrderCreationType = createSelector(
    [selectOrderCreationState],
    (orderCreationState) => orderCreationState?.orderCreationType?.value
);
