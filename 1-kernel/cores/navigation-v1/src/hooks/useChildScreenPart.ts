import {useSelector} from "react-redux";
import {getFirstReadyScreenPartByContainerKey} from "../foundations/screens";
import {selectUiVariable, UiVariable} from "./useUiVariable";
import {RootState, ScreenMode, ScreenPart} from "@impos2/kernel-core-base-v1";

const getCurrenReadyScreenPart = (containerKey: string, defaultValue: ScreenPart<any>, fromIndex?: number) =>
    getFirstReadyScreenPartByContainerKey(containerKey, fromIndex ?? -1) ?? defaultValue

export const useChildScreenPart = (variable: UiVariable<ScreenPart<any>>) => {
    return useSelector((state: RootState) =>
            selectUiVariable<ScreenPart<any>>(state, variable.key, emptyScreenPart))
        ?? getCurrenReadyScreenPart(variable.key, variable.defaultValue)
}


const emptyScreenPart: ScreenPart<any> = {
    name: "empty",
    title: "empty",
    description: "empty",
    partKey: "empty",
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE]
}