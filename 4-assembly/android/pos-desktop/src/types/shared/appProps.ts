import {ScreenMode} from "@impos2/kernel-core-base";

export interface AppProps {
    deviceId:string
    screenMode: ScreenMode
    displayCount: number
    displayIndex: number
}