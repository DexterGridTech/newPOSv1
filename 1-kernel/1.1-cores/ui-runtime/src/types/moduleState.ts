import {CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";
import {kernelCoreUiRuntimeWorkspaceState} from "./shared/moduleStateKey";
import {ScreenRuntimeState, OverlayRuntimeState, UiVariablesState} from "./state";

export type KernelCoreUiRuntimeWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelCoreUiRuntimeWorkspaceState.screen]: ScreenRuntimeState,
    [kernelCoreUiRuntimeWorkspaceState.overlay]: OverlayRuntimeState,
    [kernelCoreUiRuntimeWorkspaceState.uiVariables]: UiVariablesState,
}>
