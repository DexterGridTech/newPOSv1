import {ScreenMode} from "../types";
import {ComponentType} from "react";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export interface ScreenPart<T> {
    name: string,
    title: string,
    description: string,
    partKey: string
    id?: string | null
    containerKey?: string | null
    props?: T | null
    indexInContainer?: number | null
}

export interface ScreenPartRegistration extends ScreenPart<any> {
    componentType: ComponentType<any>
    readyToEnter?: () => boolean
    screenMode: ScreenMode[]
    instanceMode:InstanceMode[]
    workspace:Workspace[]
}
export interface ScreenPartRegister {
    registerScreenPart:(screenPart: ScreenPartRegistration)=>void
}

export const screenPartRegisters:ScreenPartRegister[]=[]
export const addScreenPartRegister = (register:ScreenPartRegister) => {
    screenPartRegisters.push(register)
}