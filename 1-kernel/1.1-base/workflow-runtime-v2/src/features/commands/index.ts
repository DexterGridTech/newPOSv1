import {defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowCommandInput,
} from '../../types'
import type {CancelWorkflowRunInput} from '../../types/observation'

export const workflowRuntimeV2CommandDefinitions = {
    runWorkflow: defineCommand<RunWorkflowCommandInput>({
        moduleName,
        commandName: 'run-workflow',
        allowReentry: true,
    }),
    cancelWorkflowRun: defineCommand<CancelWorkflowRunInput>({
        moduleName,
        commandName: 'cancel-workflow-run',
    }),
    registerWorkflowDefinitions: defineCommand<RegisterWorkflowDefinitionsInput>({
        moduleName,
        commandName: 'register-workflow-definitions',
    }),
    removeWorkflowDefinition: defineCommand<RemoveWorkflowDefinitionInput>({
        moduleName,
        commandName: 'remove-workflow-definition',
    }),
} as const

export const workflowRuntimeV2CommandNames = {
    runWorkflow: workflowRuntimeV2CommandDefinitions.runWorkflow.commandName,
    cancelWorkflowRun: workflowRuntimeV2CommandDefinitions.cancelWorkflowRun.commandName,
    registerWorkflowDefinitions: workflowRuntimeV2CommandDefinitions.registerWorkflowDefinitions.commandName,
    removeWorkflowDefinition: workflowRuntimeV2CommandDefinitions.removeWorkflowDefinition.commandName,
} as const
