import {registerUIVariable} from "@impos2/kernel-module-ui-navigation";

/**
 * 系统管理模块的 UI 变量
 *
 * 用于在不同组件之间共享状态
 */
export const systemAdminVariable = {
    adminPassword: registerUIVariable({key: 'system.admin.password', defaultValue: ''}),
    systemAdminPanel: registerUIVariable({key: 'system.admin.panel', defaultValue: ''}),
};
