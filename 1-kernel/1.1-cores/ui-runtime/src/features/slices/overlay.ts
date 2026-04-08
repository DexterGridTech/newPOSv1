import {
    batchUpdateState,
    LOG_TAGS,
    logger,
    ScreenPart
} from "@impos2/kernel-core-base";
import {
    createWorkspaceSlice,
    DisplayMode,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from "@impos2/kernel-core-interconnection";
import {PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {OverlayRuntimeState} from "../../types/state";
import {kernelCoreUiRuntimeWorkspaceState} from "../../types/shared/moduleStateKey";

const initialState: OverlayRuntimeState = {
    primaryOverlays: {
        value: [],
        updatedAt: 0
    },
    secondaryOverlays: {
        value: [],
        updatedAt: 0
    }
}

const getTargetList = (state: OverlayRuntimeState, displayMode: DisplayMode) =>
    displayMode === DisplayMode.PRIMARY ? state.primaryOverlays : state.secondaryOverlays

const slice = createWorkspaceSlice(
    kernelCoreUiRuntimeWorkspaceState.overlay,
    initialState,
    {
        openOverlay: (state, action: PayloadAction<{ overlay: ScreenPart<any>, displayMode: DisplayMode }>) => {
            const {overlay, displayMode} = action.payload
            if (!overlay.id) {
                logger.error([moduleName, LOG_TAGS.Reducer, "overlay"], 'openOverlay: overlay id is required', action.payload)
                return
            }
            const list = getTargetList(state, displayMode)
            if (list.value.some(item => item.id === overlay.id)) {
                logger.error([moduleName, LOG_TAGS.Reducer, "overlay"], 'openOverlay: overlay id already exists', action.payload)
                return
            }
            list.value.push({
                id: overlay.id,
                screenPartKey: overlay.partKey,
                props: overlay.props,
                openedAt: Date.now()
            })
            list.updatedAt = Date.now()
        },
        closeOverlay: (state, action: PayloadAction<{ overlayId: string, displayMode: DisplayMode }>) => {
            const {overlayId, displayMode} = action.payload
            const list = getTargetList(state, displayMode)
            list.value = list.value.filter(item => item.id !== overlayId)
            list.updatedAt = Date.now()
        },
        clearOverlays: (state, action: PayloadAction<{ displayMode: DisplayMode }>) => {
            const list = getTargetList(state, action.payload.displayMode)
            list.value = []
            list.updatedAt = Date.now()
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
        }
    }
)

export const overlayActions = slice.actions

export const overlaySliceConfig: WorkspaceModuleSliceConfig<OverlayRuntimeState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}
