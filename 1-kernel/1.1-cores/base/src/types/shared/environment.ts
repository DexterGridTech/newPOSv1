
export interface Environment {
    deviceId:string
    production: boolean
    screenMode: ScreenMode
    displayCount: number
    displayIndex: number
    isEmulator?: boolean
}

export enum ScreenMode {
    MOBILE = 'mobile',
    DESKTOP = 'desktop'
}
