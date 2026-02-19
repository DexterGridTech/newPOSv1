import {ApplicationManager} from "../application/applicationManager";
import {ScreenMode} from "../types";


export const getScreenMode=(): ScreenMode =>{
    return ApplicationManager.getInstance().environment?.screenMode!
}
export const getDeviceId=(): string =>{
    return ApplicationManager.getInstance().environment?.deviceId!
}
export const getProduction=(): boolean =>{
    return ApplicationManager.getInstance().environment?.production!
}


