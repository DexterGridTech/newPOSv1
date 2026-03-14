import {createSelector} from "@reduxjs/toolkit";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {kernelMixcProductState} from "../types/shared/moduleStateKey";
import {ContractState} from "../types/state/contract";
import {Contract, Product} from "../types/shared/contract";

const selectContractState = (state: any): ContractState => {
    return state[kernelMixcProductState.contract] || {};
};

export const selectProducts = createSelector(
    [selectContractState],
    (contractState: ContractState): Product[] => {
        const now = Date.now();
        const contractWrappers = Object.values(contractState).filter(Boolean);

        const validContracts = contractWrappers
            .filter((wrapper: ValueWithUpdatedAt<Contract>) => {
                const contract = wrapper?.value;
                return contract && contract.validFrom <= now && now <= contract.validTo;
            })
            .map((wrapper: ValueWithUpdatedAt<Contract>) => wrapper.value);

        if (validContracts.length === 0) {
            return [];
        }

        const latestContract = validContracts.reduce((latest: Contract, current: Contract) => {
            return current.validFrom > latest.validFrom ? current : latest;
        });

        return latestContract.productsByContract?.filter((product: Product) => product.visible) || [];
    }
);
