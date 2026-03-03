import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
import {
    createModuleInstanceModeStateKeys,
    createModuleWorkspaceStateKeys
} from "@impos2/kernel-core-interconnection";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const uiIntegrationDesktopState =  createModuleStateKeys(
    moduleName,
    [
    ] as const
);
export const uiIntegrationDesktopInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const uiIntegrationDesktopWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
