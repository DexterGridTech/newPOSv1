import {ScreenMode, ScreenPart} from "@impos2/kernel-core-base";

export interface ModalScreen<T> {
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
