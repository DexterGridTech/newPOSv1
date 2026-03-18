import {createSelector} from "@reduxjs/toolkit";
import {kernelOrderBaseState} from "../types/shared/moduleStateKey";
import {OrderState} from "../types/state/order";
import {MainOrderBase} from "../types/shared";

const selectOrderState = (state: any): OrderState => {
    return state[kernelOrderBaseState.order] || {};
};

export const selectOrders = createSelector(
    [selectOrderState],
    (orderState: OrderState): MainOrderBase[] => {
        return Object.values(orderState)
            .map(item => item?.value)
            .filter((order): order is MainOrderBase => !!order);
    }
);
