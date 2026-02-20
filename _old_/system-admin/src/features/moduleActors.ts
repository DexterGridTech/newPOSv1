import {IActor} from "_old_/base";
import {systemAdminActor} from "./actors";

/**
 * 系统管理模块的所有 Actors
 *
 * Actors 用于处理命令和业务逻辑
 */
export const moduleActors: IActor[] = [
    systemAdminActor,
];
