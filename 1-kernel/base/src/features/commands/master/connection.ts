import {defineCommand} from "../../../core";
import {ExecutionType} from "../../../types";
import {BaseModuleCommandNames} from "../commandNames";

/**
 * 终端连接状态相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_MASTER
 */

export class StartToConnectKernelWSServerCommand extends defineCommand<void>(
    BaseModuleCommandNames.StartToConnectKernelWSServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {
}

export class ReconnectKernelWSServerCommand extends defineCommand<string>(
    BaseModuleCommandNames.ReconnectKernelWSServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {
}

export class DisconnectedFromKernelWSServerCommand extends defineCommand<string>(
    BaseModuleCommandNames.DisconnectedFromKernelWSServer,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {
}

export class GetDeviceStateCommand extends defineCommand<void>(
    BaseModuleCommandNames.GetDeviceState,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {
}
