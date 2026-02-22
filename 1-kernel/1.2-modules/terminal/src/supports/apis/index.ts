import {
    ActivateDeviceRequest,
    ActivateDeviceResponse, DeactivateDeviceRequest,
    GetUnitDataByGroupRequest,
    RemoteCommandConfirmRequest,
    SendDeviceStateRequest,
    SetOperatingEntityRequest
} from "../../types/foundations/api";
import {Api, HttpMethod} from "@impos2/kernel-core-base";
import {UnitDataChangedSet} from "../../types/shared/unitData";
import {SERVER_NAME_KERNEL_API, SERVER_NAME_KERNEL_WS} from "../../foundations";


export const kernelTerminalApis = {
    activateDevice: new Api<ActivateDeviceRequest, ActivateDeviceResponse>(
        SERVER_NAME_KERNEL_API,
        '/api/device/activate',
        HttpMethod.POST
    ),
    deactivateDevice: new Api<DeactivateDeviceRequest, any>(
        SERVER_NAME_KERNEL_API,
        '/api/device/deactivate',
        HttpMethod.POST
    ),
    setOperatingEntity: new Api<SetOperatingEntityRequest, any>(
        SERVER_NAME_KERNEL_API,
        '/api/device/operating-entity',
        HttpMethod.POST
    ),
    getUnitDataByGroup: new Api<GetUnitDataByGroupRequest, UnitDataChangedSet>(
        SERVER_NAME_KERNEL_API,
        '/api/unit-data/by-group',
        HttpMethod.POST
    ),
    remoteCommandConfirm: new Api<RemoteCommandConfirmRequest, any>(
        SERVER_NAME_KERNEL_API,
        '/api/command/confirm',
        HttpMethod.POST
    ),
    sendDeviceState: new Api<SendDeviceStateRequest, any>(
        SERVER_NAME_KERNEL_API,
        '/api/device/state',
        HttpMethod.POST
    ),
}
export const kernelDeviceWS = {
    connectKernelWS: new Api<void, void>(
        SERVER_NAME_KERNEL_WS,
        '/ws/connect',
        HttpMethod.WS
    )
}