import {ScreenMode, ScreenPart} from "@impos2/kernel-core-base";

export interface ModalScreen<T = any> {
    id: string
    screenPartKey: string
    props?: T
    openedAt?: number
}

export interface OverlayEntry<T = any> extends ModalScreen<T> {
    openedAt: number
}

export interface ScreenEntry<T = any> extends ScreenPart<T> {
    source?: string
    operation?: 'show' | 'replace'
}

export interface AlertInfo {
    title: string
    message: string
    confirmText: string
    cancelText?: string
    confirmCommandName?: string
    confirmCommandPayload?: any
}

export {ScreenMode}
