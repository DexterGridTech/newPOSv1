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
export const kernelMixcOrderBaseState =  createModuleStateKeys(
    moduleName,
    [
        "order"
    ] as const
);
export const kernelMixcOrderBaseUnitDataState = createUnitDataStateKeys(
    [
        'order',
    ] as const
);
export const kernelMixcOrderBaseInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernelMixcOrderBaseWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
