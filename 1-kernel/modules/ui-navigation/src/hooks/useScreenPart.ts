import {useSelector} from "react-redux";
import {instanceInfoSlice, RootState} from "@impos2/kernel-base";
import {selectUiVariable} from "./useUiVariable";
import {getFirstReadyScreenPartByContainerKey, UIVariable} from "../core";
import {ScreenPart} from "../types";
import {uiModalsSlice} from "../features";

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