import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
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
