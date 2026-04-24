import {createModuleErrorFactory, listDefinitions} from '@next/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const workflowRuntimeV2ErrorDefinitions = {
    workflowDefinitionNotFound: defineError('workflow_definition_not_found', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_DEFINITION_NOT_FOUND',
        name: 'Workflow Definition Not Found',
        defaultTemplate: 'Workflow definition ${workflowKey} not found',
        category: 'BUSINESS',
        severity: 'MEDIUM',
    }),
    workflowDefinitionDisabled: defineError('workflow_definition_disabled', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_DEFINITION_DISABLED',
        name: 'Workflow Definition Disabled',
        defaultTemplate: 'Workflow definition ${workflowKey} is disabled',
        category: 'BUSINESS',
        severity: 'MEDIUM',
    }),
    duplicateRequest: defineError('duplicate_request', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_DUPLICATE_REQUEST',
        name: 'Workflow Duplicate Request',
        defaultTemplate: 'Workflow request ${requestId} is already active',
        category: 'BUSINESS',
        severity: 'MEDIUM',
    }),
    workflowRunNotFound: defineError('workflow_run_not_found', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_RUN_NOT_FOUND',
        name: 'Workflow Run Not Found',
        defaultTemplate: 'Workflow run not found',
        category: 'BUSINESS',
        severity: 'MEDIUM',
    }),
    workflowExecutionFailed: defineError('workflow_execution_failed', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_EXECUTION_FAILED',
        name: 'Workflow Execution Failed',
        defaultTemplate: 'Workflow ${workflowKey} execution failed',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    workflowStepFailed: defineError('workflow_step_failed', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_STEP_FAILED',
        name: 'Workflow Step Failed',
        defaultTemplate: 'Workflow step ${stepKey} failed',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    workflowScriptFailed: defineError('workflow_script_failed', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_SCRIPT_FAILED',
        name: 'Workflow Script Failed',
        defaultTemplate: 'Workflow script execution failed',
        category: 'SYSTEM',
        severity: 'HIGH',
    }),
    workflowQueueCorrupted: defineError('workflow_queue_corrupted', {
        code: 'ERR_WORKFLOW_RUNTIME_V2_QUEUE_CORRUPTED',
        name: 'Workflow Queue Corrupted',
        defaultTemplate: 'Workflow queue state is corrupted',
        category: 'SYSTEM',
        severity: 'CRITICAL',
    }),
} as const

export const workflowRuntimeV2ErrorDefinitionList = listDefinitions(workflowRuntimeV2ErrorDefinitions)
