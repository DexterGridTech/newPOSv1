import {ScreenMode} from "@impos2/kernel-core-base";
import {ComponentType} from "react";

export interface ScreenPart<T> {
    name: string,
    title: string,
    description: string,
    partKey: string
    screenMode: ScreenMode[]
    id?: string | null
    containerKey?: string | null
    props?: T | null
    indexInContainer?: number | null
}
export interface Modal<T> {
    id: string,
    screenPartKey: string,
    open: boolean
    props?: T
}

export interface ScreenPartRegistration extends ScreenPart<any> {
    componentType: ComponentType<any>
    readyToEnter?: () => boolean
}

export const createModelScreen =
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
