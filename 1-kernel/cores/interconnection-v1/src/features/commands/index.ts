import {Command, createModuleCommands, defineCommand} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../../moduleName";

export const kernelCoreInterconnectionCommands = createModuleCommands(moduleName, {
    //instance 管理
    setInstanceToMaster: defineCommand<void>(),
    setInstanceToSlave: defineCommand<void>(),
    setDisplayToPrimary: defineCommand<void>(),
    setDisplayToSecondary: defineCommand<void>(),
    setEnableSlave: defineCommand<void>(),
    setDisableSlave: defineCommand<void>(),
    setMasterInfo: defineCommand<void>(),
    clearMasterInfo: defineCommand<void>(),

    //master 连接
    startMasterServer: defineCommand<void>(),
    masterConnectedToServer: defineCommand<void>(),
    slaveConnected: defineCommand<string>(),
    slaveDisconnected: defineCommand<void>(),
    masterDisconnectedFromServer: defineCommand<string>(),


    //slave 连接
    connectMasterServer: defineCommand<void>(),
    slaveConnectedToServer: defineCommand<void>(),
    slaveDisconnectedFromServer: defineCommand<string>(),

    //远程方法
    sendToRemoteExecute: defineCommand<Command<any>>(),

    //数据同步
    synStateAtConnected: defineCommand<Record<string, Record<string, {updateAt: number}>>>(),

})

