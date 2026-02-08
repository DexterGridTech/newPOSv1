import {ComponentType} from 'react';
import {ScreenMode} from './base';

/**
 * ScreenPart 可序列化部分 - 可以存储在 Redux state 中
 */
export interface ScreenPart {
    name: string,
    title: string,
    description: string,
    partKey: string
    screenMode: ScreenMode[]
    id?: string | null
    containerKey?: string | null
    props?: any | null
    indexInContainer?: number | null
}

export interface AlertInfo {
    title: string
    message: string
    confirmText: string
    cancelText?: string
    confirmCommandName?: string
    confirmCommandPayload?: any
}

export interface ModalScreen<T> {
    id: string,
    partKey: string,
    open: boolean
    props?: T
}

/**
 * ScreenPart 完整定义 - 包含不可序列化的部分
 * 用于注册时使用
 */
export interface ScreenPartRegistration extends ScreenPart {
    componentType: ComponentType<any>
    readyToEnter?: () => boolean
}

export const createModelScreen =
    <T>(screenPart: ScreenPart, id: string, props: T) => {
        return {...screenPart, id, props}
    }

export const defaultAlertPartKey = "alert"

export const createAlert =
    (id: string, props: AlertInfo) => {
        return {
            id,
            props,
            partKey: defaultAlertPartKey,
            screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE]
        }
    }
