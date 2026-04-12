import {moduleName} from '../../moduleName'

export const workflowRuntimeCommandNames = {
    runWorkflow: `${moduleName}.run-workflow`,
    cancelWorkflowRun: `${moduleName}.cancel-workflow-run`,
    registerWorkflowDefinitions: `${moduleName}.register-workflow-definitions`,
    removeWorkflowDefinition: `${moduleName}.remove-workflow-definition`,
} as const
