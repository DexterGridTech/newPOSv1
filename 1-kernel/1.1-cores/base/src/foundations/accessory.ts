import {storeEntry} from "../types";
import {ScreenMode} from "../types";

export const getScreenMode = (): ScreenMode => storeEntry.getEnvironment().screenMode
export const getDeviceId = (): string => storeEntry.getEnvironment().deviceId
export const getProduction = (): boolean => storeEntry.getEnvironment().production
