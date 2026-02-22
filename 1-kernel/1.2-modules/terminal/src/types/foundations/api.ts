import {DeviceInfo} from "@impos2/kernel-core-base";
import {Unit} from "../shared/unit";

export interface ActivateDeviceRequest {
    device: DeviceInfo
    activeCode: string
}
export interface DeactivateDeviceRequest {
    deviceId: string
}
export interface ActivateDeviceResponse {
    terminal: Unit,
    model: Unit,
    hostEntity: Unit,
    token: string
}
export interface SetOperatingEntityRequest {
    deviceId: string
    operatingEntityId: string
}

export interface GetUnitDataByGroupRequest {
    deviceId: string
    group: string
    data:{
        id:string
        updatedAt:number
    }[]
}
export interface RemoteCommandConfirmRequest {
    commandId: string
}
export interface SendDeviceStateRequest {
    deviceId: string
    state:any
}