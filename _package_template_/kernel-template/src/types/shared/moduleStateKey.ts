import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "@impos2/kernel-core-base";
import {
    createModuleInstanceModeStateKeys,
    createModuleWorkspaceStateKeys
} from "@impos2/kernel-core-interconnection";
import {createUnitDataStateKeys} from "@impos2/kernel-core-terminal";


/**
 * 核心状态常量定义
 * 零依赖，供其他模块使用
 */
export const kernel{{PACKAGE_NAME_PASCAL}}State =  createModuleStateKeys(
    moduleName,
    [
    ] as const
);
export const kernel{{PACKAGE_NAME_PASCAL}}UnitDataState = createUnitDataStateKeys(
    [
    ] as const
);
export const kernel{{PACKAGE_NAME_PASCAL}}InstanceState= createModuleInstanceModeStateKeys(
    moduleName,
    [
    ] as const
)
export const kernel{{PACKAGE_NAME_PASCAL}}WorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
    ] as const
)
