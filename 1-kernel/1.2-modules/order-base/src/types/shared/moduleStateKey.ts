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
export const kernelOrderBaseState =  createModuleStateKeys(
    moduleName,
    [
        "order"
    ] as const
);
export const kernelOrderBaseUnitDataState = createUnitDataStateKeys(
    [
    ] as const
);
export const kernelOrderBaseInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernelOrderBaseWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
