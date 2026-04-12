import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    WorkflowDefinition,
    WorkflowDefinitionsState,
} from '../../types'

export const WORKFLOW_DEFINITIONS_STATE_KEY = 'kernel.base.workflow-runtime-v2.definitions'

const createEmptyBuckets = (): WorkflowDefinitionsState['bySource'] => ({
    module: {},
    host: {},
    remote: {},
    test: {},
})

const initialState: WorkflowDefinitionsState = {
    bySource: createEmptyBuckets(),
    updatedAt: 0,
}

const toMutableDefinition = (definition: WorkflowDefinition): WorkflowDefinition =>
    JSON.parse(JSON.stringify(definition)) as WorkflowDefinition

const sortDefinitions = (definitions: readonly WorkflowDefinition[]) =>
    definitions
        .map(toMutableDefinition)
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))

const slice = createSlice({
    name: WORKFLOW_DEFINITIONS_STATE_KEY,
    initialState,
    reducers: {
        registerDefinitions(state, action: PayloadAction<RegisterWorkflowDefinitionsInput>) {
            const bucket = state.bySource[action.payload.source]
            action.payload.definitions.forEach(definition => {
                const current = bucket[definition.workflowKey] ?? []
                const merged = [
                    ...current.filter(item => {
                        if (definition.definitionId && item.definitionId) {
                            return item.definitionId !== definition.definitionId
                        }
                        return item.workflowKey !== definition.workflowKey || item.updatedAt !== definition.updatedAt
                    }),
                    toMutableDefinition(definition),
                ]
                bucket[definition.workflowKey] = sortDefinitions(merged) as any
            })
            state.updatedAt = action.payload.updatedAt ?? Date.now()
        },
        removeDefinition(state, action: PayloadAction<RemoveWorkflowDefinitionInput>) {
            const sources = action.payload.source
                ? [action.payload.source]
                : (['module', 'host', 'remote', 'test'] as const)
            sources.forEach(source => {
                const current = state.bySource[source][action.payload.workflowKey] ?? []
                const next = current.filter(item => {
                    if (action.payload.definitionId) {
                        return item.definitionId !== action.payload.definitionId
                    }
                    return false
                })
                if (action.payload.definitionId) {
                    if (next.length > 0) {
                        state.bySource[source][action.payload.workflowKey] = next
                    } else {
                        delete state.bySource[source][action.payload.workflowKey]
                    }
                    return
                }
                delete state.bySource[source][action.payload.workflowKey]
            })
            state.updatedAt = Date.now()
        },
    },
})

export const workflowDefinitionsV2Actions = {
    registerDefinitions: (payload: RegisterWorkflowDefinitionsInput) =>
        slice.actions.registerDefinitions(payload),
    removeDefinition: (payload: RemoveWorkflowDefinitionInput) =>
        slice.actions.removeDefinition(payload),
}

export const workflowDefinitionsV2SliceDescriptor: StateRuntimeSliceDescriptor<WorkflowDefinitionsState> = {
    name: WORKFLOW_DEFINITIONS_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'field',
            stateKey: 'bySource',
            flushMode: 'immediate',
        },
    ],
}
