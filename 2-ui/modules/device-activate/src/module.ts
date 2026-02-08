import { KernelModule } from "@impos2/kernel-base";
import { moduleName } from "./moduleName";
import { moduleReducers, moduleEpics, moduleActors } from "./features";
import { moduleScreenParts } from "./ui";
import { uiCoreBaseModule } from "@impos2/ui-core-base-2";

/**
 * 设备激活UI 模块定义
 *
 * 职责：
 * 1. 提供 设备激活UI 相关的 UI 组件
 * 2. 管理 设备激活UI 相关的业务逻辑
 * 3. 提供 设备激活UI 相关的页面和弹窗
 */
export const uiDeviceActivateModule: KernelModule = {
    name: moduleName,
    reducers: moduleReducers,
    epics: moduleEpics,
    actors: moduleActors,
    screenParts: moduleScreenParts,
    dependencies: [
        uiCoreBaseModule
    ]
};
