import { storeEntry } from "../types";
export const getScreenMode = () => storeEntry.getEnvironment().screenMode;
export const getDeviceId = () => storeEntry.getEnvironment().deviceId;
export const getProduction = () => storeEntry.getEnvironment().production;
