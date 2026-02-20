import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base-v1";
import {
    createModuleInstanceModeStateKeys,
    createModuleWorkspaceStateKeys
} from "@impos2/kernel-core-interconnection-v1";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelXXXState =  createModuleStateKeys(
    moduleName,
    [
    ] as const
);
export const kernelXXXInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernelXXXWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
