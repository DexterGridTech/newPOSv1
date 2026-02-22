import {UiVariable} from "@impos2/kernel-core-navigation";

export const uiAdminVariables:Record<string, UiVariable<any>> = {
    adminPassword: {key: 'system.admin.password', defaultValue: ''},
    systemAdminPanel: {key: 'system.admin.panel', defaultValue: ''},
}