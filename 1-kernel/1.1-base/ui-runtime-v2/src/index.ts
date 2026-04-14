import {packageVersion} from './generated/packageVersion'

export {moduleName} from './moduleName'
export {packageVersion}

export {uiRuntimeV2ModuleManifest} from './application/moduleManifest'
export {
    createUiRuntimeModuleV2,
    uiRuntimeModuleV2Descriptor,
    uiRuntimeV2PreSetup,
} from './application/createModule'
export {uiRuntimeV2CommandDefinitions} from './features/commands'
export {
    uiRuntimeV2StateActions,
    uiRuntimeV2StateSlices,
} from './features/slices'
export {
    uiRuntimeV2ErrorDefinitions,
    uiRuntimeV2ErrorDefinitionList,
} from './supports/errors'
export {
    uiRuntimeV2ParameterDefinitions,
    uiRuntimeV2ParameterDefinitionList,
} from './supports/parameters'
export {
    createUiAlertDefinition,
    createUiAlertScreen,
    createUiModalScreen,
    createUiOverlayEntry,
    createUiOverlayScreen,
    createUiScreenRuntimeEntry,
    defaultUiAlertPartKey,
} from './foundations/screenFactory'
export {createUiScreenRegistry} from './foundations/screenRegistry'
export {
    getUiScreenRegistry,
    normalizeUiRuntimeWorkspace,
    registerUiScreenDefinition,
    registerUiScreenDefinitions,
    selectFirstReadyUiScreenDefinition,
    selectUiCurrentScreenOrFirstReady,
    selectUiOverlays,
    selectUiRuntimeCurrentDisplayMode,
    selectUiRuntimeCurrentInstanceMode,
    selectUiRuntimeCurrentWorkspace,
    selectUiScreen,
    selectUiScreenDefinition,
    selectUiScreenDefinitionsByContainer,
    selectUiScreenRendererKey,
    selectUiVariable,
} from './selectors'
export type {
    UiAlertInfo,
    UiOverlayEntry,
    UiOverlayRuntimeState,
    UiScreenDefinition,
    UiRuntimeCreateOverlayInput,
    UiRuntimeCreateScreenInput,
    UiRuntimeScreenRegistry,
    UiScreenRuntimeEntry,
    UiScreenRuntimeState,
    UiVariableRuntimeState,
} from './types'
