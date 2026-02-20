import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";

/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelTerminalState = createModuleStateKeys(
    moduleName,
    [
        'terminal',
    ] as const
);
