import {Command, createModuleCommands, defineCommand, ExecutionType} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreInterconnectionCommands = createModuleCommands(moduleName, {
    //instance 管理
    setInstanceToMaster: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    setInstanceToSlave: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    setDisplayToPrimary: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    setDisplayToSecondary: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    setEnableSlave: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    setDisableSlave: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    setMasterInfo: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    clearMasterInfo: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),

    //master 连接
    startMasterServer: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    masterConnectedToServer: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    slaveConnected: defineCommand<{ name: string, deviceId: string }>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    slaveDisconnected: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    masterDisconnectedFromServer: defineCommand<string>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),


    //slave 连接
    connectMasterServer: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE),
    slaveConnectedToServer: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE),
    slaveDisconnectedFromServer: defineCommand<string>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE),

    //slave 远程方法
    slaveSendMasterExecute: defineCommand<Command<any>>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE),

    //数据同步
    synStateAtConnected: defineCommand<Record<string, Record<string, {updateAt: number}>>>(ExecutionType.SLAVE_SEND_MASTER_EXECUTE)
})

