import { defineCommand } from "../../../core";
import { ExecutionType } from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 初始化命令
 * ExecutionType: SEND_AND_EXECUTE_SEPARATELY
 */
export class InitializeCommand extends defineCommand<void>(
    BaseModuleCommandNames.Initialize,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
