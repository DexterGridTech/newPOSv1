import {ScreenMode} from "../types";
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

export interface ScreenPartRegistration extends ScreenPart<any> {
    componentType: ComponentType<any>
    readyToEnter?: () => boolean
}
export interface screenPartRegister{
    registerScreenPart:(screenPart: ScreenPartRegistration)=>void
}

export const screenPartRegisters:screenPartRegister[]=[]
export const addScreenPartRegister = (register:screenPartRegister) => {
    screenPartRegisters.push(register)
}