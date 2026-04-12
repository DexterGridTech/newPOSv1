import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const workflowRuntimeErrorDefinitions = {
    workflowDefinitionNotFound: {
        key: 'kernel.base.workflow-runtime.workflow_definition_not_found',
        name: 'Workflow Definition Not Found',
        defaultTemplate: 'Workflow definition ${workflowKey} is not found',
        category: 'VALIDATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    workflowDefinitionDisabled: {
        key: 'kernel.base.workflow-runtime.workflow_definition_disabled',
        name: 'Workflow Definition Disabled',
        defaultTemplate: 'Workflow definition ${workflowKey} is disabled',
        category: 'VALIDATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    workflowRunDuplicateRequest: {
        key: 'kernel.base.workflow-runtime.workflow_run_duplicate_request',
        name: 'Workflow Duplicate Request',
        defaultTemplate: 'Workflow request ${requestId} is already active',
        category: 'VALIDATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    workflowRunNotFound: {
        key: 'kernel.base.workflow-runtime.workflow_run_not_found',
        name: 'Workflow Run Not Found',
        defaultTemplate: 'Workflow run is not found',
        category: 'VALIDATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    workflowQueueCorrupted: {
        key: 'kernel.base.workflow-runtime.workflow_queue_corrupted',
        name: 'Workflow Queue Corrupted',
        defaultTemplate: 'Workflow queue state is corrupted',
        category: 'SYSTEM',
        severity: 'CRITICAL',
        moduleName,
    } satisfies ErrorDefinition,
    workflowStepFailed: {
        key: 'kernel.base.workflow-runtime.workflow_step_failed',
        name: 'Workflow Step Failed',
        defaultTemplate: 'Workflow step ${stepKey} failed',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    workflowScriptFailed: {
        key: 'kernel.base.workflow-runtime.workflow_script_failed',
        name: 'Workflow Script Failed',
        defaultTemplate: 'Workflow script execution failed',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const workflowRuntimeErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    workflowRuntimeErrorDefinitions,
)
