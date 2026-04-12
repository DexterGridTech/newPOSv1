import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TcpBindingContext, TcpBindingState} from '../../types'
import {TCP_BINDING_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TcpBindingState = {}

const slice = createSlice({
    name: TCP_BINDING_STATE_KEY,
    initialState,
    reducers: {
        replaceBinding: (_state, action: PayloadAction<TcpBindingContext>) => ({
            ...action.payload,
        }),
        clearBinding: () => ({
            ...initialState,
        }),
    },
})

export const tcpBindingActions = slice.actions

export const tcpBindingSliceDescriptor: StateRuntimeSliceDescriptor<TcpBindingState> = {
    name: TCP_BINDING_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {kind: 'field', stateKey: 'platformId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'tenantId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'brandId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'projectId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'storeId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'profileId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'templateId', flushMode: 'immediate'},
    ],
}
