import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
import {createUnitDataStateKeys} from "./createUnitDataStateKeys";

/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernelCoreTerminalState = createModuleStateKeys(
    moduleName,
    [
        'terminal',
        'terminalConnection',
    ] as const
);

export const kernelCoreTerminalUnitDataState = createUnitDataStateKeys(
    [
        'unitData_errorMessages',
        'unitData_systemParameters',
        'unitData_taskDefinitions',
    ] as const
);
