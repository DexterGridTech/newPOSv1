import { defineCommand } from "../../../core/command";
import { ExecutionType, Unit } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 终端设备信息相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_MASTER
 */

export class ActivateDeviceCommand extends defineCommand<{ activateCode: string }>(
    BaseModuleCommandNames.ActivateDevice,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class ActivateDeviceSuccessCommand extends defineCommand<void>(
    BaseModuleCommandNames.ActivateDeviceSuccess,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class DeactivateDeviceCommand extends defineCommand<string>(
    BaseModuleCommandNames.DeactivateDevice,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class SetOperatingEntityCommand extends defineCommand<Unit>(
    BaseModuleCommandNames.SetOperatingEntity,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class SetOperatingEntityCompleteCommand extends defineCommand<void>(
    BaseModuleCommandNames.SetOperatingEntityComplete,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class KernelWebSocketConnectedCommand extends defineCommand<void>(
    BaseModuleCommandNames.KernelWebSocketConnected,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}
