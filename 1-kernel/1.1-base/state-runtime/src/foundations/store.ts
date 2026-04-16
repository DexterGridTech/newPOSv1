import {combineReducers, configureStore, type Reducer} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '../types/slice'

const STATE_RUNTIME_REPLACE_ACTION = '@@kernel.base.state-runtime/replace'
const STATE_RUNTIME_RESET_ACTION = '@@kernel.base.state-runtime/reset'

export const createReplaceStateRuntimeAction = (slices: Record<string, unknown>) => ({
    type: STATE_RUNTIME_REPLACE_ACTION,
    payload: slices,
})

export const createResetStateRuntimeAction = () => ({
    type: STATE_RUNTIME_RESET_ACTION,
})

export const createStateStore = (
    slices: readonly StateRuntimeSliceDescriptor[],
) => {
    const reducerMap: Record<string, Reducer> = {}

    for (const slice of slices) {
        if (slice.reducer) {
            reducerMap[slice.name] = slice.reducer
        }
    }

    if (Object.keys(reducerMap).length === 0) {
        reducerMap.__state_runtime_placeholder__ = (state = null) => state
    }

    const combinedReducer = combineReducers(reducerMap)
    const rootReducer: Reducer = (state, action) => {
        if (action.type === STATE_RUNTIME_REPLACE_ACTION) {
            const incomingSlices = (action as {payload?: Record<string, unknown>}).payload ?? {}
            return combinedReducer({
                ...(state as Record<string, unknown> | undefined),
                ...incomingSlices,
            }, {type: '@@kernel.base.state-runtime/init'})
        }

        if (action.type === STATE_RUNTIME_RESET_ACTION) {
            return combinedReducer(undefined, {type: '@@kernel.base.state-runtime/init'})
        }

        return combinedReducer(state, action)
    }

    return configureStore({
        reducer: rootReducer,
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({
                serializableCheck: false,
                immutableCheck: false,
            }),
    })
}
