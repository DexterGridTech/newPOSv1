import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "./createModuleStateKeys";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelCoreBaseState = createModuleStateKeys(
    moduleName,
    [
        'requestStatus',
        'errorMessages',
        'systemParameters'
    ] as const
);
