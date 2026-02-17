import {moduleName} from "../../moduleName";
import {createModuleWorkspaceStateKeys} from "@impos2/kernel-core-interconnection";

/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelCoreNavigationState = createModuleWorkspaceStateKeys(
    moduleName,
    [
        'uiVariables'
    ] as const
)