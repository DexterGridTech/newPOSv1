import { defineCommand } from "../../../core/command";
import {ExecutionType, Workspace} from "../../../types";
import { BaseModuleCommandNames } from "../commandNames";

/**
 * 初始化命令
 * ExecutionType: SEND_AND_EXECUTE_SEPARATELY
 */
export class InitializeCommand extends defineCommand<void>(
    BaseModuleCommandNames.Initialize,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}

export class NextDataVersionCommand extends defineCommand<void>(
    BaseModuleCommandNames.NextDataVersion,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}

export class UpdateWorkSpaceCommand extends defineCommand<Workspace>(
    BaseModuleCommandNames.UpdateWorkSpace,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}

export class RestartApplicationCommand extends defineCommand<Workspace>(
    BaseModuleCommandNames.RestartApplication,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
