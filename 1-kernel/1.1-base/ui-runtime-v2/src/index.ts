import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * ui-runtime-v2 是 navigation 的新版基础能力，统一管理 screen、overlay、alert、workspace 和 UI 变量的 kernel 状态。
 * 它只提供 UI 运行协议和状态，不依赖 React；具体渲染器由 2-ui 或 assembly 侧根据 rendererKey/definition 自行接入。
 */
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
