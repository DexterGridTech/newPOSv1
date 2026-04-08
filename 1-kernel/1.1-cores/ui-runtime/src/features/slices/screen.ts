import {
    batchUpdateState,
    LOG_TAGS,
    logger,
    PERSIST_KEY,
    ScreenPart
} from "@impos2/kernel-core-base";
import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from "@impos2/kernel-core-interconnection";
import {PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {kernelCoreUiRuntimeWorkspaceState} from "../../types/shared/moduleStateKey";
import {ScreenRuntimeState} from "../../types/state";

const initialState: ScreenRuntimeState = {}

const buildEntry = (target: ScreenPart<any>, operation: 'show' | 'replace', source?: string) => ({
    ...target,
    source,
    operation
})

const slice = createWorkspaceSlice(
    kernelCoreUiRuntimeWorkspaceState.screen,
    initialState,
    {
        showScreen: (state, action: PayloadAction<{ target: ScreenPart<any>, source?: string }>) => {
            const {target, source} = action.payload
            const {containerKey} = target
            if (!containerKey) {
                logger.error([moduleName, LOG_TAGS.Reducer, "screen"], 'showScreen: containerKey is required', action.payload)
                return
            }
            state[containerKey] = {
                value: buildEntry(target, 'show', source),
                updatedAt: Date.now()
            }
        },
        replaceScreen: (state, action: PayloadAction<{ target: ScreenPart<any>, source?: string }>) => {
            const {target, source} = action.payload
            const {containerKey} = target
            if (!containerKey) {
                logger.error([moduleName, LOG_TAGS.Reducer, "screen"], 'replaceScreen: containerKey is required', action.payload)
                return
            }
            state[containerKey] = {
                value: buildEntry(target, 'replace', source),
                updatedAt: Date.now()
            }
        },
        resetScreen: (state, action: PayloadAction<{ containerKey: string }>) => {
            const {containerKey} = action.payload
            if (!containerKey || containerKey === PERSIST_KEY) {
                return
            }
            state[containerKey] = {value: null, updatedAt: Date.now()}
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
        }
    }
)

export const screenActions = slice.actions

export const screenSliceConfig: WorkspaceModuleSliceConfig<ScreenRuntimeState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}
