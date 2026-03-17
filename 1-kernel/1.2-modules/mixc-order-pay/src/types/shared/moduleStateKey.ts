import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
import {
    createModuleInstanceModeStateKeys,
    createModuleWorkspaceStateKeys
} from "@impos2/kernel-core-interconnection";
import {createUnitDataStateKeys} from "@impos2/kernel-core-terminal";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelMixcOrderPayState =  createModuleStateKeys(
    moduleName,
    [
        'paymentFunction'
    ] as const
);
export const kernelMixcOrderPayUnitDataState = createUnitDataStateKeys(
    [
        'unitData_paymentFunction'
    ] as const
);
export const kernelMixcOrderPayInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernelMixcOrderPayWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
        'payingOrder'
    ] as const
)
