import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
import {createModuleWorkspaceStateKeys} from "@impos2/kernel-core-interconnection";
import {createUnitDataStateKeys} from "@impos2/kernel-core-terminal";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelPayBaseState =  createModuleStateKeys(
    moduleName,
    [
        'paymentFunction'
    ] as const
);
export const kernelPayBaseUnitDataState = createUnitDataStateKeys(
    [
        'unitData_paymentFunction'
    ] as const
);
export const kernelPayBaseWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
        'payingOrder',
        'paymentRequest'
    ] as const
)
