
export interface Environment {
    deviceId:string
    production: boolean
    screenMode: ScreenMode
    displayCount: number
    displayIndex: number
}

export enum ScreenMode {
    MOBILE = 'mobile',
    DESKTOP = 'desktop'
}