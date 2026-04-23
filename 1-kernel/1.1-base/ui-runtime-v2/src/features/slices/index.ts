export * from './screenState'
export * from './overlayState'
export * from './uiVariableState'

import {uiRuntimeV2ScreenStateActions, uiRuntimeV2ScreenStateSlices} from './screenState'
import {uiRuntimeV2OverlayStateActions, uiRuntimeV2OverlayStateSlices} from './overlayState'
import {uiRuntimeV2VariableStateActions, uiRuntimeV2VariableStateSlices} from './uiVariableState'

export const uiRuntimeV2StateActions = {
    ...uiRuntimeV2ScreenStateActions,
    ...uiRuntimeV2OverlayStateActions,
    ...uiRuntimeV2VariableStateActions,
}

export const uiRuntimeV2StateSlices = [
    ...uiRuntimeV2ScreenStateSlices,
    ...uiRuntimeV2OverlayStateSlices,
    ...uiRuntimeV2VariableStateSlices,
] as const
