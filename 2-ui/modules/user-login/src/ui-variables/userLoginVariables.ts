import {registerUIVariable} from "@impos2/kernel-base";

export const userLoginVariable={
    userId:registerUIVariable({key:'ui.user.login.userId',defaultValue:''}),
    password:registerUIVariable({key:'ui.user.login.password',defaultValue:''})
}