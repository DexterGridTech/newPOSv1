import {useSelector} from "react-redux";
import {RootState, ScreenPart} from "@impos2/kernel-core-base";
import {getFirstReadyScreenPartByContainerKey} from "../foundations";
import {selectCurrentScreen} from "../selectors";
import {UiVariable} from "./useUiVariable";

const getCurrentReadyScreenPart = (containerKey: string, defaultValue: ScreenPart<any>, fromIndex?: number) =>
    getFirstReadyScreenPartByContainerKey(containerKey, fromIndex ?? -1) ?? defaultValue

export const useChildScreenPart = (variable: UiVariable<ScreenPart<any>>) => {
    return useSelector((state: RootState) =>
        selectCurrentScreen<ScreenPart<any>>(state, variable.key, getCurrentReadyScreenPart(variable.key, variable.defaultValue))
    )
}
