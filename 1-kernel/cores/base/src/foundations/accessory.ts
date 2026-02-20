import {ApplicationManager} from "../application/applicationManager";
import {ScreenMode} from "../types";


export const getScreenMode = (): ScreenMode => {
    const mode = ApplicationManager.getInstance().environment?.screenMode
    if (mode == null) throw new Error('Environment not initialized')
    return mode
}
export const getDeviceId = (): string => {
    const id = ApplicationManager.getInstance().environment?.deviceId
    if (id == null) throw new Error('Environment not initialized')
    return id
}
export const getProduction = (): boolean => {
    const production = ApplicationManager.getInstance().environment?.production
    if (production == null) throw new Error('Environment not initialized')
    return production
}


