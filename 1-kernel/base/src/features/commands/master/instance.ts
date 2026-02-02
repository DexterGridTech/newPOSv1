import { defineCommand } from "../../../core";
import { ExecutionType, SlaveConnectionInfo } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 实例管理相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_MASTER
 */

export class AddSlaveCommand extends defineCommand<{ name: string }>(
    BaseModuleCommandNames.AddSlave,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class SlaveAddedCommand extends defineCommand<{ name: string }>(
    BaseModuleCommandNames.SlaveAdded,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class RemoveSlaveCommand extends defineCommand<{ name: string }>(
    BaseModuleCommandNames.RemoveSlave,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}
export class RegisterSlaveCommand extends defineCommand<{ name: string; deviceId: string }>(
    BaseModuleCommandNames.RegisterSlave,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class UnregisterSlaveCommand extends defineCommand<{ name: string; deviceId: string }>(
    BaseModuleCommandNames.UnregisterSlave,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}
