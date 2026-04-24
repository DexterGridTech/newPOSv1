import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowCommandInput,
} from '../../types'
import type {CancelWorkflowRunInput} from '../../types/observation'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const workflowRuntimeV2CommandDefinitions = {
    runWorkflow: defineModuleCommand<RunWorkflowCommandInput>('run-workflow', {
        allowReentry: true,
    }),
    cancelWorkflowRun: defineModuleCommand<CancelWorkflowRunInput>('cancel-workflow-run'),
    registerWorkflowDefinitions: defineModuleCommand<RegisterWorkflowDefinitionsInput>('register-workflow-definitions'),
    removeWorkflowDefinition: defineModuleCommand<RemoveWorkflowDefinitionInput>('remove-workflow-definition'),
} as const

export const workflowRuntimeV2CommandNames = {
    runWorkflow: workflowRuntimeV2CommandDefinitions.runWorkflow.commandName,
    cancelWorkflowRun: workflowRuntimeV2CommandDefinitions.cancelWorkflowRun.commandName,
    registerWorkflowDefinitions: workflowRuntimeV2CommandDefinitions.registerWorkflowDefinitions.commandName,
    removeWorkflowDefinition: workflowRuntimeV2CommandDefinitions.removeWorkflowDefinition.commandName,
} as const
