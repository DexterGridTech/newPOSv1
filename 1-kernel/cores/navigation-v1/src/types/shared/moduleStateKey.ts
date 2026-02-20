import {moduleName} from "../../moduleName";
import {createModuleWorkspaceStateKeys} from "@impos2/kernel-core-interconnection-v1";

/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelCoreNavigationWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
        'uiVariables'
    ] as const
)