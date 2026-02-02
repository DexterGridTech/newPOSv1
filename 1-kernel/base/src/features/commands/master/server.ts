import { defineCommand } from "../../../core";
import { ExecutionType, SlaveConnection } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 主设备服务器状态相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_MASTER
 */

export class SlaveConnectedCommand extends defineCommand<SlaveConnection>(
    BaseModuleCommandNames.SlaveConnected,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class SlaveDisconnectedCommand extends defineCommand<SlaveConnection>(
    BaseModuleCommandNames.SlaveDisconnected,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class StartMasterServerCommand extends defineCommand<void>(
    BaseModuleCommandNames.StartMasterServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class MasterDisconnectedFromMasterServerCommand extends defineCommand<string>(
    BaseModuleCommandNames.MasterDisconnectedFromMasterServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class RestartMasterServerCommand extends defineCommand<string>(
    BaseModuleCommandNames.RestartMasterServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}
