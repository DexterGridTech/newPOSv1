import {useSelector} from "react-redux";
import {getFirstReadyScreenPartByContainerKey} from "../foundations/screens";
import {selectUiVariable, UiVariable} from "./useUiVariable";
import {RootState, ScreenPart} from "@impos2/kernel-core-base";

const getCurrenReadyScreenPart = (containerKey: string, defaultValue: ScreenPart<any>, fromIndex?: number) =>
    getFirstReadyScreenPartByContainerKey(containerKey, fromIndex ?? -1) ?? defaultValue

export const useChildScreenPart = (variable: UiVariable<ScreenPart<any>>) => {
    return useSelector((state: RootState) =>
        selectUiVariable<ScreenPart<any>>(state, variable.key, getCurrenReadyScreenPart(variable.key, variable.defaultValue))
    )
}