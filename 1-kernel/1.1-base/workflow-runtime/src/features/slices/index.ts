import {workflowDefinitionsStateSliceDescriptor} from './workflowDefinitions'
import {workflowObservationsStateSliceDescriptor} from './workflowObservations'
import {workflowQueueStateSliceDescriptor} from './workflowQueue'

export {
    WORKFLOW_DEFINITIONS_STATE_KEY,
    workflowDefinitionsStateActions,
} from './workflowDefinitions'
export {
    WORKFLOW_OBSERVATIONS_STATE_KEY,
    workflowObservationsStateActions,
} from './workflowObservations'
export {
    WORKFLOW_QUEUE_STATE_KEY,
    workflowQueueStateActions,
} from './workflowQueue'

export const workflowRuntimeStateSlices = [
    workflowDefinitionsStateSliceDescriptor,
    workflowObservationsStateSliceDescriptor,
    workflowQueueStateSliceDescriptor,
] as const
