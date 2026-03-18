import {createSelector} from "@reduxjs/toolkit";
import {kernelProductFromContractState} from "../types/shared/moduleStateKey";
import {ContractState} from "../types/state/contract";
import {Contract} from "../types/shared";

const selectContractState = (state: any): ContractState => {
    return state[kernelProductFromContractState.contract] || {};
};

export const selectContracts = createSelector(
    [selectContractState],
    (contractState: ContractState): Contract[] => {
        return Object.values(contractState)
            .map(item => item?.value)
            .filter((contract): contract is Contract => !!contract);
    }
);
