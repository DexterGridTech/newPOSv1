import {registerUIVariable} from "@impos2/kernel-module-ui-navigation";

export const userLoginVariable={
    userId:registerUIVariable({key:'ui.user.login.userId',defaultValue:''}),
    password:registerUIVariable({key:'ui.user.login.password',defaultValue:''})
}