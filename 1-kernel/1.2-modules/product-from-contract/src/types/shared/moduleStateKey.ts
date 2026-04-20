import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
import {createUnitDataStateKeys} from "@impos2/kernel-core-terminal";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelProductFromContractState =  createModuleStateKeys(
    moduleName,
    [
        "contract"
    ] as const
);
export const kernelProductFromContractUnitDataState = createUnitDataStateKeys(
    [
        'unitData_contract',
    ] as const
);
