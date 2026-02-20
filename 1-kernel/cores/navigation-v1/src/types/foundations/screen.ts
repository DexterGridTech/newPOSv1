import {ScreenMode, ScreenPart} from "@impos2/kernel-core-base-v1";

export interface Modal<T> {
    id: string,
    screenPartKey: string,
    open: boolean
    props?: T
}

export const createModalScreen =
    <T>(screenPart: ScreenPart<T>, id: string, props: T) => {
        return {...screenPart, id, props}
    }


export interface AlertInfo {
    title: string
    message: string
    confirmText: string
    cancelText?: string
    confirmCommandName?: string
    confirmCommandPayload?: any
}

export const defaultAlertScreenPartKey = "application.default.alert"

export const createAlert =
    (id: string, props: AlertInfo) => {
        return {
            id,
            props,
            partKey: defaultAlertScreenPartKey,
            name: "Alert",
            title:"Alert",
            description:"Alert",
            screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE]
        }
    }
