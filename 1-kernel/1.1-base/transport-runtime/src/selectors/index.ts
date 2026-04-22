import type {RootState} from '@impos2/kernel-base-state-runtime'
import {TRANSPORT_SERVER_SPACE_STATE_KEY} from '../foundations/stateKeys'
import type {TransportServerSpaceRuntimeState} from '../features/slices'

export const selectTransportServerSpaceState = (
    state: RootState,
): TransportServerSpaceRuntimeState | undefined =>
    state[TRANSPORT_SERVER_SPACE_STATE_KEY as keyof RootState] as TransportServerSpaceRuntimeState | undefined

export const selectTransportSelectedServerSpace = (
    state: RootState,
): string | undefined => selectTransportServerSpaceState(state)?.selectedSpace

export const selectTransportAvailableServerSpaces = (
    state: RootState,
): readonly string[] => selectTransportServerSpaceState(state)?.availableSpaces ?? []
