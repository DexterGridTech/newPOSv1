import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    WorkflowDefinition,
    WorkflowDefinitionsBySource,
    WorkflowDefinitionsState,
} from '../../types'

export const WORKFLOW_DEFINITIONS_STATE_KEY = 'kernel.base.workflow-runtime.definitions'

const initialState: WorkflowDefinitionsState = {
    bySource: {
        module: {},
        host: {},
        remote: {},
        test: {},
    },
    updatedAt: 0,
}

const emptyDefinitionsBySource = (): WorkflowDefinitionsBySource => ({
    module: {},
    host: {},
    remote: {},
    test: {},
})

const buildDefinitionsByKey = (
    definitions: readonly WorkflowDefinition[],
): Record<string, readonly WorkflowDefinition[]> => {
    const byKey: Record<string, readonly WorkflowDefinition[]> = {}
    definitions.forEach(definition => {
        const current = byKey[definition.workflowKey] ?? []
        byKey[definition.workflowKey] = [...current, definition]
    })
    return byKey
}

const slice = createSlice({
    name: WORKFLOW_DEFINITIONS_STATE_KEY,
    initialState,
    reducers: {
        replaceDefinitions(state, action: PayloadAction<{
            definitions: readonly WorkflowDefinition[]
            source: keyof WorkflowDefinitionsBySource
            updatedAt: number
        }>) {
            return {
                bySource: {
                    ...state.bySource,
                    [action.payload.source]: buildDefinitionsByKey(action.payload.definitions),
                },
                updatedAt: action.payload.updatedAt,
            }
        },
        upsertDefinitions(state, action: PayloadAction<{
            definitions: readonly WorkflowDefinition[]
            source: keyof WorkflowDefinitionsBySource
            updatedAt: number
        }>) {
            const bySource: WorkflowDefinitionsBySource = JSON.parse(
                JSON.stringify(state.bySource),
            ) as WorkflowDefinitionsBySource
            const byKey = bySource[action.payload.source] ?? {}

            action.payload.definitions.forEach(definition => {
                const current = byKey[definition.workflowKey] ?? []
                const next = [...current]
                const matchIndex = definition.definitionId == null
                    ? next.findIndex(item => item.moduleName === definition.moduleName)
                    : next.findIndex(item => item.definitionId === definition.definitionId)
                if (matchIndex >= 0) {
                    next[matchIndex] = definition
                } else {
                    next.push(definition)
                }
                byKey[definition.workflowKey] = next
            })
            bySource[action.payload.source] = byKey

            return {
                bySource,
                updatedAt: action.payload.updatedAt,
            }
        },
        removeDefinition(state, action: PayloadAction<{
            workflowKey: string
            definitionId?: string
            source: keyof WorkflowDefinitionsBySource
            updatedAt: number
        }>) {
            const bySource: WorkflowDefinitionsBySource = JSON.parse(
                JSON.stringify(state.bySource),
            ) as WorkflowDefinitionsBySource
            const byKey = bySource[action.payload.source] ?? {}
            const current = byKey[action.payload.workflowKey] ?? []
            const next = action.payload.definitionId == null
                ? []
                : current.filter(item => item.definitionId !== action.payload.definitionId)
            if (next.length === 0) {
                delete byKey[action.payload.workflowKey]
            } else {
                byKey[action.payload.workflowKey] = next
            }
            bySource[action.payload.source] = byKey

            return {
                bySource,
                updatedAt: action.payload.updatedAt,
            }
        },
        resetDefinitionsBySource(state, action: PayloadAction<{
            source: keyof WorkflowDefinitionsBySource
            updatedAt: number
        }>) {
            return {
                bySource: {
                    ...state.bySource,
                    [action.payload.source]: {},
                },
                updatedAt: action.payload.updatedAt,
            }
        },
    },
})

export const workflowDefinitionsStateActions = {
    replaceDefinitions(payload: {
        definitions: readonly WorkflowDefinition[]
        source: keyof WorkflowDefinitionsBySource
        updatedAt: number
    }) {
        return slice.actions.replaceDefinitions(payload)
    },
    upsertDefinitions(payload: {
        definitions: readonly WorkflowDefinition[]
        source: keyof WorkflowDefinitionsBySource
        updatedAt: number
    }) {
        return slice.actions.upsertDefinitions(payload)
    },
    removeDefinition(payload: {
        workflowKey: string
        definitionId?: string
        source: keyof WorkflowDefinitionsBySource
        updatedAt: number
    }) {
        return slice.actions.removeDefinition(payload)
    },
    resetDefinitionsBySource(payload: {
        source: keyof WorkflowDefinitionsBySource
        updatedAt: number
    }) {
        return slice.actions.resetDefinitionsBySource(payload)
    },
}

export const workflowDefinitionsStateSliceDescriptor: StateRuntimeSliceDescriptor<WorkflowDefinitionsState> = {
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
