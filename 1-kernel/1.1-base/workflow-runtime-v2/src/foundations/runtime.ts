import type {ActorExecutionContext} from '@next/kernel-base-runtime-shell-v2'
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowInput,
    RunWorkflowSummary,
    WorkflowRuntimeFacadeV2,
} from '../types'

export interface WorkflowRuntimeRegistryRecord {
    runtime?: WorkflowRuntimeFacadeV2
    addObserver?: (requestId: string, listener: {next: (observation: any) => void; complete: () => void}) => () => void
    runFromCommand?: (
        runInput: RunWorkflowInput,
        actorContext: ActorExecutionContext,
    ) => Promise<RunWorkflowSummary>
    registerDefinitions?: (input: RegisterWorkflowDefinitionsInput) => void
    removeDefinition?: (input: RemoveWorkflowDefinitionInput) => void
    cancel?: WorkflowRuntimeFacadeV2['cancel']
}
