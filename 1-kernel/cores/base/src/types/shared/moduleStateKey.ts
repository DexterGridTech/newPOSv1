import {moduleName} from "../../moduleName";

/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelCoreBaseState = {
    requestStatus: `${moduleName}.requestStatus`,
    errorMessages:`${moduleName}.errorMessages`,
    systemParameters:`${moduleName}.systemParameters`
} as const
