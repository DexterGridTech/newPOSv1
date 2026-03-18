import {moduleName} from "../../moduleName";
import {kernelProductFromContractCommands} from "../commands";
import {Actor, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {contractActions} from "../slices/contract";
import {
    kernelProductBaseCommands,
    kernelProductBaseState,
    ProductBase,
    ProductState
} from "@impos2/kernel-product-base";
import {kernelProductFromContractState} from "../../types/shared/moduleStateKey";
import {ContractState} from "../../types/state/contract";

export class ContractActor extends Actor {
    updateContracts =
        Actor.defineCommandHandler(kernelProductFromContractCommands.updateContracts,
            async (command): Promise<Record<string, any>> => {
                logger.log([moduleName, LOG_TAGS.Actor, "ContractActor"], 'updateContracts')
                const updatedContracts = command.payload
                Object.keys(updatedContracts).forEach(key => {
                    const valueWithUpdatedValue = command.payload[key]
                    if (valueWithUpdatedValue && valueWithUpdatedValue.value && typeof valueWithUpdatedValue.value === 'string') {
                        try {
                            valueWithUpdatedValue.value = JSON.parse(valueWithUpdatedValue.value);
                        } catch (e) {
                            logger.error([moduleName, LOG_TAGS.Actor, "ContractActor"], `Failed to parse value for key ${key}`, e);
                        }
                    }
                })
                storeEntry.dispatchAction(contractActions.batchUpdateState(updatedContracts))

                const contractState: ContractState = storeEntry.getStateByKey(kernelProductFromContractState.contract);
                const products: Record<string, ProductBase> = {};

                Object.values(contractState).forEach(contractWrapper => {
                    if (contractWrapper?.value?.productsByContract) {
                        contractWrapper.value.productsByContract.forEach(product => {
                            products[product.productCode] = product;
                        });
                    }
                });

                const currentProductState: ProductState = storeEntry.getStateByKey(kernelProductBaseState.product);
                const updatePayload: Record<string, any> = {};

                Object.keys(currentProductState).forEach(productCode => {
                    if (!products[productCode]) {
                        updatePayload[productCode] = null;
                    }
                });

                Object.entries(products).forEach(([productCode, product]) => {
                    updatePayload[productCode] = {
                        value: product,
                        updatedAt: Date.now()
                    };
                });

                if (Object.keys(updatePayload).length > 0) {
                    kernelProductBaseCommands.updateProduct(updatePayload).executeInternally();
                }

                return Promise.resolve({});
            });
}

