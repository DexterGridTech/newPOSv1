import { defineCommand } from "../../../core";
import { ExecutionType } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 从设备连接主设备状态相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_SLAVE 和 SLAVE_SEND_MASTER_EXECUTE
 */

export class StartToConnectMasterServerCommand extends defineCommand<void>(
    BaseModuleCommandNames.StartToConnectMasterServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
) {}

export class ReconnectMasterServerCommand extends defineCommand<string>(
    BaseModuleCommandNames.ReconnectMasterServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
) {}

export class SlaveDisconnectedFromMasterServerCommand extends defineCommand<string>(
    BaseModuleCommandNames.SlaveDisconnectedFromMasterServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
) {}

export class ConnectedToMasterCommand extends defineCommand<void>(
    BaseModuleCommandNames.ConnectedToMaster,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
) {}

export class SynStateAtConnectedCommand extends defineCommand<{ [stateKey: string]: number | null }>(
    BaseModuleCommandNames.SynStateAtConnected,
    ExecutionType.SLAVE_SEND_MASTER_EXECUTE
) {}
