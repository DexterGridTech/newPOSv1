import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base-v1";
import {createModuleInstanceModeStateKeys} from "../foundations/instanceModeStateKeys";

/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */

export const kernelCoreInterconnectionState = createModuleStateKeys(
    moduleName,
    [
        'instanceInfo',
        'instanceInterconnection',
    ] as const
);

export const kernelCoreInterconnectionInstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
        'requestStatus'
    ] as const
)
