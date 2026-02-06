/**
 * 所有命令名称常量统一管理
 */
export const BaseModuleCommandNames = {
    // 初始化相关
    Initialize: "InitializeCommand",
    NextDataVersion: "NextDataVersionCommand",
    Navigation: "NavigationCommand",

    // 主设备相关 (Master)
    AddSlave: "AddSlaveCommand",
    SlaveAdded: "SlaveAddedCommand",
    RemoveSlave: "RemoveSlaveCommand",
    RegisterSlave: "RegisterSlaveCommand",
    UnregisterSlave: "UnregisterSlaveCommand",
    SlaveConnected: "SlaveConnectedCommand",
    SlaveDisconnected: "SlaveDisconnectedCommand",
    StartMasterServer: "StartMasterServerCommand",
    MasterDisconnectedFromMasterServer: "MasterDisconnectedFromMasterServerCommand",
    RestartMasterServer: "RestartMasterServerCommand",

    // 从设备相关 (Slave)
    SetSlaveInfo: "SetSlaveInfoCommand",
    StartToConnectMasterServer: "StartToConnectMasterServerCommand",
    ReconnectMasterServer: "ReconnectMasterServerCommand",
    SlaveDisconnectedFromMasterServer: "SlaveDisconnectedFromMasterServerCommand",
    ConnectedToMaster: "ConnectedToMasterCommand",
    SynStateAtConnected: "SynStateAtConnectedCommand",

    // 终端设备相关
    ActivateDevice: "ActivateDeviceCommand",
    ActivateDeviceSuccess: "ActivateDeviceSuccessCommand",
    DeactivateDevice: "DeactivateDeviceCommand",
    SetOperatingEntity: "SetOperatingEntityCommand",
    SetOperatingEntityComplete: "SetOperatingEntityCompleteCommand",
    KernelWebSocketConnected: "KernelWebSocketConnectedCommand",
    StartToConnectKernelWSServer: "StartToConnectKernelWSServerCommand",
    ReconnectKernelWSServer: "ReconnectKernelWSServerCommand",
    DisconnectedFromKernelWSServer: "DisconnectedFromKernelWSServerCommand",
    GetDeviceState: "GetDeviceStateCommand",

    // 单元数据相关
    GetUnitData: "GetUnitDataCommand",
    ChangeUnitData: "ChangeUnitDataCommand",
    UnitDataChanged: "UnitDataChangedCommand",
} as const;
