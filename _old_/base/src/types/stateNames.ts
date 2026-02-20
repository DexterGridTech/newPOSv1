import {
    InstanceInfoState,
    DeviceStatusState,
    MasterServerStatusState,
    SlaveConnectionStatusState,
    SystemParametersState,
    RequestStatusState,
    TerminalInfoState,
    TerminalConnectionStatusState,
    UiVariablesState,
    UiModalsState
} from "./state";

export const KernelBaseStateNames = {
    instanceInfo: 'instanceInfo' as const,
    deviceStatus: 'deviceStatus' as const,
    masterServerStatus: 'masterServerStatus' as const,
    slaveConnectionStatus: 'slaveConnectionStatus' as const,
    systemParameters: 'systemParameters' as const,
    requestStatus: 'requestStatus' as const,
    terminalInfo: 'terminalInfo' as const,
    terminalConnectionStatus: 'terminalConnectionStatus' as const,
    uiVariables: 'uiVariables' as const,
    uiModals: 'uiModals' as const,
} as const

export type KernelBaseStateMap = {
    [KernelBaseStateNames.instanceInfo]: InstanceInfoState;
    [KernelBaseStateNames.deviceStatus]: DeviceStatusState;
    [KernelBaseStateNames.masterServerStatus]: MasterServerStatusState;
    [KernelBaseStateNames.slaveConnectionStatus]: SlaveConnectionStatusState;
    [KernelBaseStateNames.systemParameters]: SystemParametersState;
    [KernelBaseStateNames.requestStatus]: RequestStatusState;
    [KernelBaseStateNames.terminalInfo]: TerminalInfoState;
    [KernelBaseStateNames.terminalConnectionStatus]: TerminalConnectionStatusState;
    [KernelBaseStateNames.uiVariables]: UiVariablesState;
    [KernelBaseStateNames.uiModals]: UiModalsState;
}