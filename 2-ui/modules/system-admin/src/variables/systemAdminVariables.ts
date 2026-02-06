import {registerUIVariable} from "@impos2/kernel-module-ui-navigation";

/**
 * 系统管理模块的 UI 变量
 *
 * 用于在不同组件之间共享状态
 */
export const systemAdminVariable = {
    // 示例：管理员名称
    adminName: registerUIVariable({key: 'systemAdmin.adminName', defaultValue: ''}),

    // 示例：系统设置
    systemSettings: registerUIVariable({key: 'systemAdmin.systemSettings', defaultValue: {}}),
};
