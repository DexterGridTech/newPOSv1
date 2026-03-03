import {Command, createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {MasterInfo} from "../../types";

export const kernelCoreInterconnectionCommands = createModuleCommands(moduleName, {
    //instance 管理
    setInstanceToMaster: defineCommand<void>(),
    setInstanceToSlave: defineCommand<void>(),
    setDisplayToPrimary: defineCommand<void>(),
    setDisplayToSecondary: defineCommand<void>(),
    setEnableSlave: defineCommand<void>(),
    setDisableSlave: defineCommand<void>(),
    setMasterInfo: defineCommand<MasterInfo>(),
    clearMasterInfo: defineCommand<void>(),

    //连接管理（统一 master/slave）
    startConnection: defineCommand<void>(),
    connectedToServer: defineCommand<void>(),
    disconnectedFromServer: defineCommand<string>(),
    peerConnected: defineCommand<string>(),
    peerDisconnected: defineCommand<void>(),

    //远程方法
    sendToRemoteExecute: defineCommand<Command<any>>(),

    //数据同步
    synStateAtConnected: defineCommand<Record<string, Record<string, {updatedAt: number}>>>(),

})

