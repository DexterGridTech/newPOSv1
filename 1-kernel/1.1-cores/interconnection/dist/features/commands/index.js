import { createModuleCommands, defineCommand } from "@impos2/kernel-core-base";
import { moduleName } from "../../moduleName";
export const kernelCoreInterconnectionCommands = createModuleCommands(moduleName, {
    shouldSwitchToPrimaryDisplay: defineCommand(),
    shouldSwitchToSecondaryDisplay: defineCommand(),
    //instance 管理
    setInstanceToMaster: defineCommand(),
    setInstanceToSlave: defineCommand(),
    setDisplayToPrimary: defineCommand(),
    setDisplayToSecondary: defineCommand(),
    setEnableSlave: defineCommand(),
    setDisableSlave: defineCommand(),
    setMasterInfo: defineCommand(),
    clearMasterInfo: defineCommand(),
    //连接管理（统一 master/slave）
    startConnection: defineCommand(),
    connectedToServer: defineCommand(),
    disconnectedFromServer: defineCommand(),
    peerConnected: defineCommand(),
    peerDisconnected: defineCommand(),
    //远程方法
    sendToRemoteExecute: defineCommand(),
    //数据同步
    synStateAtConnected: defineCommand(),
});
