import {useSelector} from "react-redux";
import {instanceInfoSlice} from "../features/slices/instanceInfo";
import {RootState} from "../features/rootState";
import {selectUiVariable} from "./useUiVariable";
import {UIVariable} from "../core/uiVariable";
import {getFirstReadyScreenPartByContainerKey} from "../core/screen";
import {ScreenPart} from "../types/core/screen";
import {uiModalsSlice} from "../features/slices/uiModals";

const getCurrenReadyScreenPart = (containerKey: string, defaultValue: ScreenPart, fromIndex?: number) =>
    getFirstReadyScreenPartByContainerKey(containerKey, fromIndex ?? -1) ?? defaultValue

export const useChildScreenPart = (variable: UIVariable<ScreenPart>) => {
    return useSelector((state: RootState) =>
            selectUiVariable<ScreenPart>(state, variable.key))
        ?? getCurrenReadyScreenPart(variable.key, variable.defaultValue)
}

const selectUiModels = (state: RootState) => state[uiModalsSlice.name][state[instanceInfoSlice.name].instance.instanceMode];

export const useUiModels = () => {
    return useSelector((state: RootState) => selectUiModels(state))
}
