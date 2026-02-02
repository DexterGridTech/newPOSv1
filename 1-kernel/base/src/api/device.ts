import {Api, HttpMethod} from "../core";
import {KERNEL_API_SERVER_NAME, KERNEL_WS_SERVER_NAME} from "./server/kernelServer";
import {DeviceInfo, Unit, UnitDataChangedSet} from "../types";


export interface ActivateDeviceRequest {
    device: DeviceInfo
    activeCode: string
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

export const kernelDeviceAPI={
    activateDevice : new Api<ActivateDeviceRequest, ActivateDeviceResponse>(
        KERNEL_API_SERVER_NAME,
        '/api/device/activate',
        HttpMethod.POST
    ),
    setOperatingEntity : new Api<SetOperatingEntityRequest, any>(
        KERNEL_API_SERVER_NAME,
        '/api/device/operating-entity',
        HttpMethod.POST
    ),
    getUnitDataByGroup : new Api<GetUnitDataByGroupRequest, UnitDataChangedSet>(
        KERNEL_API_SERVER_NAME,
        '/api/unit-data/by-group',
        HttpMethod.POST
    ),
    remoteCommandConfirm : new Api<RemoteCommandConfirmRequest, any>(
        KERNEL_API_SERVER_NAME,
        '/api/command/confirm',
        HttpMethod.POST
    ),
    sendDeviceState : new Api<SendDeviceStateRequest, any>(
        KERNEL_API_SERVER_NAME,
        '/api/device/state',
        HttpMethod.POST
    ),
}
export const kernelDeviceWS={
    connectKernelWS : new Api<void, void>(
        KERNEL_WS_SERVER_NAME,
        '/ws/connect',
        HttpMethod.WS
    )
}