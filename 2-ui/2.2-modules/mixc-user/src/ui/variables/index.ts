import {UiVariable} from "@impos2/kernel-core-navigation";

export const uiMixcUserVariables:Record<string, UiVariable<any>> = {
    loginMode:{key: 'user.login.loginMode', defaultValue: 'password'},
    username:{key: 'user.login.username', defaultValue: ''},
    password:{key: 'user.login.password', defaultValue: ''},
    phone:{key: 'user.login.phone', defaultValue: ''},
    qrcodeUrl:{key: 'user.login.qrcodeUrl', defaultValue: ''},
}