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
export const kernelMixcUserLoginState =  createModuleStateKeys(
    moduleName,
    [
        "user"
    ] as const
);
export const kernelMixcUserLoginUnitDataState = createUnitDataStateKeys(
    [
        'unitData_user',
    ] as const
);
export const kernelMixcUserLoginInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernelMixcUserLoginWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
