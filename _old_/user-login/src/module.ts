import { KernelModule } from "_old_/base";
import { moduleName } from "./moduleName";
import { moduleReducers, moduleEpics, moduleActors } from "./features";
import { moduleScreenParts } from "./ui";
import { uiCoreBaseModule } from "_old_/base-2";
import {kernalUserModule} from "_old_/user";

/**
 * 用户登录UI 模块定义
 *
 * 职责：
 * 1. 提供 用户登录UI 相关的 UI 组件
 * 2. 管理 用户登录UI 相关的业务逻辑
 * 3. 提供 用户登录UI 相关的页面和弹窗
 */
export const uiUserLoginModule: KernelModule = {
    name: moduleName,
    reducers: moduleReducers,
    epics: moduleEpics,
    actors: moduleActors,
    screenParts: moduleScreenParts,
    dependencies: [
        kernalUserModule,
        uiCoreBaseModule
    ]
};
