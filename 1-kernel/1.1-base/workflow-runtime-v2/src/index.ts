import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * workflow-runtime-v2 负责动态工作流定义、串行队列执行和 Observable 运行观测。
 * workflow 定义可以来自 module、host 或 TDP topic；执行过程和最终结果都落入 observation，让 command 和 UI selector 使用同一套视图。
 */
export {moduleName} from './moduleName'
export {packageVersion}

export {workflowRuntimeV2ModuleManifest} from './application/moduleManifest'
export {
    createWorkflowRuntimeModuleV2,
    workflowRuntimeModuleV2Descriptor,
    workflowRuntimeV2PreSetup,
    DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC_V2,
} from './application/createModule'
export {workflowRuntimeV2CommandDefinitions, workflowRuntimeV2CommandNames} from './features/commands'
export {
    workflowRuntimeV2StateActions,
    workflowRuntimeV2StateSlices,
} from './features/slices'
export {
    workflowRuntimeV2ErrorDefinitions,
    workflowRuntimeV2ErrorDefinitionList,
} from './supports/errors'
export {
    workflowRuntimeV2ParameterDefinitions,
    workflowRuntimeV2ParameterDefinitionList,
} from './supports/parameters'
export {
    selectActiveWorkflowObservation,
    selectWorkflowDefinition,
    selectWorkflowDefinitionsBySource,
    selectWorkflowDefinitionsState,
    selectWorkflowObservationByRequestId,
    selectWorkflowObservationStatusByRequestId,
    selectWorkflowQueueState,
} from './selectors'
export type {
    CreateWorkflowRuntimeModuleV2Input,
    RunWorkflowSummary,
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowQueueState,
    WorkflowRuntimeFacadeV2,
    WorkflowRuntimeV2,
    WorkflowRunStatus,
} from './types'
