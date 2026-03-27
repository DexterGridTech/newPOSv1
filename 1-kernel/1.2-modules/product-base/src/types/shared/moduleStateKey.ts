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
export const kernelProductBaseState =  createModuleStateKeys(
    moduleName,
    [
        "product"
    ] as const
);
export const kernelProductBaseUnitDataState = createUnitDataStateKeys(
    [
    ] as const
);
export const kernelProductBaseInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernelProductBaseWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
