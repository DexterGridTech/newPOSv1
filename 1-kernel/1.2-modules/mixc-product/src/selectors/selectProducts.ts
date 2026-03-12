import {createSelector} from "@reduxjs/toolkit";
import {storeEntry, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {kernelMixcProductState} from "../types/shared/moduleStateKey";
import {ContractState} from "../types/state/contract";
import {Contract, Product} from "../types/shared/contract";

/**
 * 获取 contract state
 */
const selectContractState = (): ContractState => {
    return storeEntry.getStateByKey(kernelMixcProductState.contract);
};

/**
 * 选择当前生效的 products
 * 遍历所有 contract，找到当前生效的（validFrom <= now <= validTo）
 * 如果有多个生效的 contract，返回最新的（validFrom 最大的）contract 中的所有 products
 */
export const selectProducts = createSelector(
    [selectContractState],
    (contractState: ContractState): Product[] => {
        const now = Date.now();
        const contractWrappers = Object.values(contractState);

        // 过滤出当前生效的 contracts
        const validContracts = contractWrappers
            .filter((wrapper: ValueWithUpdatedAt<Contract>) => {
                const contract = wrapper.value;
                return contract.validFrom <= now && now <= contract.validTo;
            })
            .map((wrapper: ValueWithUpdatedAt<Contract>) => wrapper.value);

        // 如果没有生效的 contract，返回空数组
        if (validContracts.length === 0) {
            return [];
        }

        // 找到 validFrom 最大的 contract（最新的）
        const latestContract = validContracts.reduce((latest: Contract, current: Contract) => {
            return current.validFrom > latest.validFrom ? current : latest;
        });

        // 返回最新 contract 中的所有 products
        return latestContract.productsByContract || [];
    }
);
