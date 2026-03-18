import {createSelector} from "@reduxjs/toolkit";
import {kernelProductBaseState} from "../types/shared/moduleStateKey";
import {ProductState} from "../types/state/product";
import {ProductBase} from "../types/shared/product";

const selectProductState = (state: any): ProductState => {
    return state[kernelProductBaseState.product] || {};
};

export const selectProducts = createSelector(
    [selectProductState],
    (productState: ProductState): ProductBase[] => {
        const now = Date.now();
        return Object.values(productState)
            .map(item => item?.value)
            .filter((product): product is ProductBase =>
                !!product &&
                product.visible &&
                (!product.valid || product.valid.some(period => period.validFrom <= now && period.validTo >= now))
            );
    }
);
