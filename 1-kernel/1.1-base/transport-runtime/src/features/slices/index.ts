export * from './serverSpaceState'

import {
    transportServerSpaceStateActions,
    transportServerSpaceStateSliceDescriptor,
} from './serverSpaceState'

export const transportRuntimeStateActions = {
    ...transportServerSpaceStateActions,
}

export const transportRuntimeStateSlices = [
    transportServerSpaceStateSliceDescriptor,
] as const
