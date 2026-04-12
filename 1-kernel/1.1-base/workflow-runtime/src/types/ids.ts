export type Brand<TValue, TBrand extends string> = TValue & {readonly __brand: TBrand}

export type WorkflowDefinitionId = Brand<string, 'WorkflowDefinitionId'>
export type WorkflowRunId = Brand<string, 'WorkflowRunId'>
export type WorkflowStepRunId = Brand<string, 'WorkflowStepRunId'>
