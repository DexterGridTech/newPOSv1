import { defineCommand } from "../../../core";
import { ExecutionType, UnitDataChangedSet } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 单元数据相关命令
 * ExecutionType: ONLY_SEND_AND_EXECUTE_ON_MASTER
 */

export class GetUnitDataCommand extends defineCommand<{ group: string }>(
    BaseModuleCommandNames.GetUnitData,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class ChangeUnitDataCommand extends defineCommand<{ changeSet: UnitDataChangedSet }>(
    BaseModuleCommandNames.ChangeUnitData,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}

export class UnitDataChangedCommand extends defineCommand<{ changeSet: UnitDataChangedSet }>(
    BaseModuleCommandNames.UnitDataChanged,
    ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
) {}
