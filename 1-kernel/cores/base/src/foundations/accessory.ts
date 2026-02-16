import {ApplicationManager} from "../application/applicationManager";
import {ScreenMode} from "../types";


export const getScreenMode=(): ScreenMode =>{
    return ApplicationManager.getInstance().screenMode!
}
export const getDeviceId=(): string =>{
    return ApplicationManager.getInstance().deviceId!
}
export const getProduction=(): boolean =>{
    return ApplicationManager.getInstance().production!
}


