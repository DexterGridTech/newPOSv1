export * from './workflowDefinitions'
export * from './workflowObservations'
export * from './workflowQueue'

import {
    workflowDefinitionsV2Actions,
    workflowDefinitionsV2SliceDescriptor,
} from './workflowDefinitions'
import {
    workflowObservationsV2Actions,
    workflowObservationsV2SliceDescriptor,
} from './workflowObservations'
import {
    workflowQueueV2Actions,
    workflowQueueV2SliceDescriptor,
} from './workflowQueue'

export const workflowRuntimeV2StateActions = {
    ...workflowDefinitionsV2Actions,
    ...workflowObservationsV2Actions,
    ...workflowQueueV2Actions,
}

export const workflowRuntimeV2StateSlices = [
    workflowDefinitionsV2SliceDescriptor,
    workflowObservationsV2SliceDescriptor,
    workflowQueueV2SliceDescriptor,
] as const
