import {KernelModule} from "_old_/base";
import {moduleActors, moduleEpics, moduleReducers} from "./features";
import {uiCoreBaseModule} from "_old_/base-2";
import {moduleName} from './moduleName';
import {moduleScreenParts} from "./ui";

/**
 * 系统管理模块
 *
 * 职责：
 * 1. 提供系统管理相关的 UI 组件
 * 2. 管理系统管理相关的业务逻辑
 * 3. 提供系统管理相关的页面和弹窗
 */
export const uiSystemAdminModule: KernelModule = {
    name: moduleName,
    reducers: moduleReducers,
    epics: moduleEpics,
    actors: moduleActors,
    screenParts: moduleScreenParts,
    dependencies:[
        uiCoreBaseModule
    ]
};
