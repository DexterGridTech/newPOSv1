import { defineCommand } from "../../../core/command";
import { ExecutionType, SlaveConnectionInfo } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 从设备实例信息相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_SLAVE
 */

export class SetSlaveInfoCommand extends defineCommand<SlaveConnectionInfo>(
    BaseModuleCommandNames.SetSlaveInfo,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
) {}
